/**
 * 가계부 자동입력 - Google Apps Script
 * 
 * 농협 입출금 알림 이메일을 읽어서 가계부에 자동 등록합니다.
 * 
 * Script Properties에 설정 필요:
 * - SUPABASE_URL: https://xxx.supabase.co
 * - SUPABASE_KEY: Supabase anon key
 * - PARSE_API_URL: https://your-app.vercel.app/api/parse-email
 * - PARSE_API_KEY: API 인증 키
 * - EMAIL_PASSWORD: 보안메일 비밀번호 (생년월일 6자리)
 */

// ─── 설정 ───
const LABEL_NAME = '자동입력완료';
const SEARCH_QUERY = 'from:webmaster@ums-oto.nonghyup.com subject:"입출금 거래내역" has:attachment -label:' + LABEL_NAME;

// 다용도 거래처: "이름|금액" 조합으로 학습
const MULTI_PURPOSE = ['카카오페이', '네이버페이', '토스', '이체', 'NH체크'];

function getProps() {
  const props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl: props.getProperty('SUPABASE_URL'),
    supabaseKey: props.getProperty('SUPABASE_KEY'),
    parseApiUrl: props.getProperty('PARSE_API_URL'),
    parseApiKey: props.getProperty('PARSE_API_KEY'),
    emailPassword: props.getProperty('EMAIL_PASSWORD'),
  };
}

// ─── 메인 함수: 1시간마다 실행 ───
function processNewEmails() {
  const config = getProps();
  if (!config.supabaseUrl || !config.emailPassword) {
    console.log('설정이 완료되지 않았습니다. Script Properties를 확인하세요.');
    return;
  }

  // 라벨 가져오기 (없으면 생성)
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
  }

  // 카테고리 학습 규칙 가져오기
  const rules = getCategoryRules(config);

  // 새 농협 이메일 검색
  const threads = GmailApp.search(SEARCH_QUERY, 0, 10);
  console.log('새 이메일 ' + threads.length + '건 발견');

  let totalProcessed = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();
    
    for (const message of messages) {
      // 이미 처리된 메시지인지 확인 (라벨은 스레드 단위이므로 날짜로도 체크)
      const attachments = message.getAttachments();
      const htmlAttachment = attachments.find(a => 
        a.getName().toLowerCase().endsWith('.html') || 
        a.getContentType().includes('html')
      );

      if (!htmlAttachment) continue;

      try {
        const htmlContent = htmlAttachment.getDataAsString();
        const transactions = parseAndCategorize(htmlContent, config, rules);
        
        if (transactions.length > 0) {
          // 출금만 가계부에 등록
          const withdrawals = transactions.filter(t => t.type === 'withdrawal');
          
          for (const tx of withdrawals) {
            // 중복 체크
            if (isDuplicate(config, tx)) {
              console.log('중복 건너뛰기: ' + tx.title + ' ' + tx.amount);
              continue;
            }

            // Supabase에 등록
            insertExpense(config, tx);
            totalProcessed++;
          }
        }
      } catch (e) {
        console.error('메시지 처리 실패:', e.message);
      }
    }

    // 처리 완료 라벨 추가
    thread.addLabel(label);
  }

  console.log('총 ' + totalProcessed + '건 등록 완료');
}

// ─── 이메일 파싱 및 카테고리 분류 ───
function parseAndCategorize(htmlContent, config, rules) {
  // Vercel API로 복호화 및 파싱
  const response = UrlFetchApp.fetch(config.parseApiUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': config.parseApiKey || '',
    },
    payload: JSON.stringify({
      html: htmlContent,
      password: config.emailPassword,
      categoryRules: rules,
    }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  if (status !== 200) {
    throw new Error('API 오류 (' + status + '): ' + response.getContentText());
  }

  const result = JSON.parse(response.getContentText());
  return result.transactions || [];
}

// ─── Supabase: 카테고리 학습 규칙 조회 ───
function getCategoryRules(config) {
  try {
    const response = UrlFetchApp.fetch(
      config.supabaseUrl + '/rest/v1/category_rules?select=pattern,category',
      {
        headers: {
          'apikey': config.supabaseKey,
          'Authorization': 'Bearer ' + config.supabaseKey,
        },
        muteHttpExceptions: true,
      }
    );
    
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
  } catch (e) {
    console.warn('학습 규칙 조회 실패:', e.message);
  }
  return [];
}

// ─── Supabase: 중복 체크 ───
function isDuplicate(config, tx) {
  try {
    const query = encodeURIComponent(
      'date=eq.' + tx.date + '&amount=eq.' + tx.amount + '&title=eq.' + tx.title
    );
    const response = UrlFetchApp.fetch(
      config.supabaseUrl + '/rest/v1/expenses?select=id&' + 
      'date=eq.' + encodeURIComponent(tx.date) + 
      '&amount=eq.' + tx.amount + 
      '&title=eq.' + encodeURIComponent(tx.title),
      {
        headers: {
          'apikey': config.supabaseKey,
          'Authorization': 'Bearer ' + config.supabaseKey,
        },
        muteHttpExceptions: true,
      }
    );
    
    if (response.getResponseCode() === 200) {
      const existing = JSON.parse(response.getContentText());
      return existing.length > 0;
    }
  } catch (e) {
    console.warn('중복 체크 실패:', e.message);
  }
  return false;
}

// ─── Supabase: 지출 등록 ───
function insertExpense(config, tx) {
  const expense = {
    title: tx.title,
    amount: tx.amount,
    date: tx.date,
    category: tx.category || '기타',
    value_type: tx.value_type || null,
    excluded: false,
  };

  const response = UrlFetchApp.fetch(
    config.supabaseUrl + '/rest/v1/expenses',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': 'Bearer ' + config.supabaseKey,
        'Prefer': 'return=minimal',
      },
      payload: JSON.stringify(expense),
      muteHttpExceptions: true,
    }
  );

  const status = response.getResponseCode();
  if (status >= 300) {
    throw new Error('지출 등록 실패 (' + status + '): ' + response.getContentText());
  }

  console.log('등록: ' + tx.title + ' ' + tx.amount + '원 → ' + tx.category);
}

// ─── 시간 트리거 설정 ───
function setupTrigger() {
  // 기존 트리거 제거
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'processNewEmails') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 1시간마다 실행
  ScriptApp.newTrigger('processNewEmails')
    .timeBased()
    .everyHours(1)
    .create();

  console.log('트리거 설정 완료: 1시간마다 processNewEmails 실행');
}

// ─── 수동 테스트 ───
function testRun() {
  console.log('=== 테스트 실행 ===');
  const config = getProps();
  console.log('Supabase URL:', config.supabaseUrl ? '설정됨' : '❌ 미설정');
  console.log('Parse API URL:', config.parseApiUrl ? '설정됨' : '❌ 미설정');
  console.log('Email Password:', config.emailPassword ? '설정됨' : '❌ 미설정');
  
  processNewEmails();
}
