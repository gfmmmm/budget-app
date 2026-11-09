import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { decryptVestMail } = require('@/lib/vestmail-decrypt.js')

interface Transaction {
  date: string       // YYYY-MM-DD
  time: string       // HH:MM:SS
  title: string      // 거래처명 / 적요
  amount: number     // 금액
  type: 'withdrawal' | 'deposit'  // 출금 / 입금
  balance: number    // 잔액
}

// 키워드 기반 카테고리 매칭
const KEYWORD_RULES: [RegExp, string][] = [
  [/택시|카카오T|타다|교통|주유|기름|셀프|SK에너지|GS칼텍스|현대오일/i, '교통'],
  [/카페|스타벅스|이디야|메가|컴포즈|빽다방|투썸|할리스|블루보틀|폴바셋|커피빈/i, '커피'],
  [/편의점|GS25|CU |씨유|세븐일레븐|이마트24|미니스톱/i, '식비'],
  [/배달|요기요|배민|배달의민족|쿠팡이츠|식당|치킨|피자|족발|떡볶이|김밥|분식|한식|중식|일식|맥도날드|버거킹|KFC|롯데리아|서브웨이/i, '식비'],
  [/쿠팡|무신사|지그재그|에이블리|올리브영|다이소/i, '쇼핑'],
  [/술|맥주|소주|와인|이자카야|호프|바 |펍/i, '술자리'],
  [/넷플릭스|유튜브|디즈니|웨이브|왓챠|스포티파이|멜론|지니|애플뮤직|ChatGPT|Claude|Anthropic|OpenAI/i, '구독비'],
  [/관리비|월세|전기|가스|수도|통신|KT|SK텔레콤|LG유플러스/i, '주거비'],
  [/CGV|메가박스|롯데시네마|영화|공연|전시|박물관|도서/i, '문화'],
  [/마트|이마트|홈플러스|코스트코|트레이더스/i, '생활비'],
]

function categorize(title: string, rules: Array<{pattern: string; category: string}>): { category: string; needsReview: boolean } {
  // 1. DB 학습 규칙 먼저 확인
  for (const rule of rules) {
    if (title.includes(rule.pattern) || rule.pattern === title) {
      return { category: rule.category, needsReview: false }
    }
  }

  // 2. 키워드 매칭
  for (const [regex, category] of KEYWORD_RULES) {
    if (regex.test(title)) {
      return { category, needsReview: false }
    }
  }

  // 3. 매칭 실패 → 판단필요
  return { category: '기타', needsReview: true }
}

function parseTransactionHTML(html: string): Transaction[] {
  const transactions: Transaction[] = []

  // 농협 거래내역 테이블 파싱
  // 일반적 형식: 거래일시 | 적요 | 출금액 | 입금액 | 잔액 | 거래점
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi)
  if (!tableMatch) return transactions

  for (const table of tableMatch) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi)
    if (!rows) continue

    for (const row of rows) {
      const cells = row.match(/<td[\s\S]*?<\/td>/gi)
      if (!cells || cells.length < 4) continue

      // 셀 텍스트 추출
      const cellTexts = cells.map(cell =>
        cell.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      )

      // 날짜 패턴 찾기: YYYY-MM-DD 또는 YYYY.MM.DD 또는 MM-DD
      const dateCell = cellTexts.find(t => /\d{4}[-./]\d{2}[-./]\d{2}/.test(t) || /\d{2}[-./]\d{2}\s+\d{2}:\d{2}/.test(t))
      if (!dateCell) continue

      // 날짜/시간 파싱
      let date = '', time = ''
      const fullDateMatch = dateCell.match(/(\d{4})[-./](\d{2})[-./](\d{2})\s*(\d{2}:\d{2}(?::\d{2})?)/)
      if (fullDateMatch) {
        date = `${fullDateMatch[1]}-${fullDateMatch[2]}-${fullDateMatch[3]}`
        time = fullDateMatch[4]
      } else {
        const shortDateMatch = dateCell.match(/(\d{2})[-./](\d{2})\s+(\d{2}:\d{2})/)
        if (shortDateMatch) {
          const year = new Date().getFullYear()
          date = `${year}-${shortDateMatch[1]}-${shortDateMatch[2]}`
          time = shortDateMatch[3]
        }
      }
      if (!date) continue

      // 금액 파싱 (쉼표 제거, 숫자만)
      const amounts = cellTexts
        .map(t => {
          const m = t.replace(/,/g, '').match(/^(\d+)$/)
          return m ? parseInt(m[1]) : 0
        })

      // 적요(거래처명) 찾기 - 숫자가 아닌 셀 중 날짜도 아닌 것
      const titleCell = cellTexts.find(t =>
        t && !/^\d/.test(t) && !t.includes(':') && t !== dateCell && t.length > 1
      ) || ''

      // 출금/입금 판별 (보통 출금이 먼저, 입금이 그 다음)
      const nonZeroAmounts = amounts.filter(a => a > 0)
      if (nonZeroAmounts.length === 0) continue

      const amount = nonZeroAmounts[0]
      const balance = nonZeroAmounts.length > 1 ? nonZeroAmounts[nonZeroAmounts.length - 1] : 0

      // 출금액/입금액 위치로 타입 결정
      const withdrawalIdx = cellTexts.findIndex((t, i) => i > 0 && amounts[i] === amount)
      const type: 'withdrawal' | 'deposit' = withdrawalIdx <= cellTexts.length / 2 ? 'withdrawal' : 'deposit'

      transactions.push({ date, time, title: titleCell, amount, type, balance })
    }
  }

  return transactions
}

export async function POST(request: Request) {
  // API 키 확인
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.PARSE_API_KEY && process.env.PARSE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { html, password, categoryRules = [] } = await request.json()

    if (!html || !password) {
      return NextResponse.json({ error: 'html and password are required' }, { status: 400 })
    }

    // 1. HTML에서 암호화된 데이터 추출
    const match = html.match(/s\[0\] = "([\s\S]*?)";/)
    if (!match) {
      return NextResponse.json({ error: 'No encrypted data found in HTML' }, { status: 400 })
    }

    // 2. SEED 복호화
    const decrypted = decryptVestMail(match[1], password)
    if (!decrypted) {
      return NextResponse.json({ error: 'Decryption failed - wrong password?' }, { status: 400 })
    }

    // 3. HTML 파싱하여 거래 내역 추출
    const rawTransactions = parseTransactionHTML(decrypted)

    // 4. 카테고리 분류
    const transactions = rawTransactions.map(tx => {
      const { category, needsReview } = categorize(tx.title, categoryRules)
      return {
        ...tx,
        category,
        value_type: needsReview ? 'review' : null,
      }
    })

    return NextResponse.json({
      success: true,
      totalFound: transactions.length,
      withdrawals: transactions.filter(t => t.type === 'withdrawal').length,
      deposits: transactions.filter(t => t.type === 'deposit').length,
      transactions,
      // 디버깅용: 복호화된 HTML의 처음 500자
      previewHtml: decrypted.slice(0, 500),
    })
  } catch (error) {
    console.error('Parse email error:', error)
    return NextResponse.json(
      { error: 'Internal error', details: String(error) },
      { status: 500 }
    )
  }
}
