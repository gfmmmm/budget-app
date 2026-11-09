import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (password === process.env.APP_PASSWORD) {
    const res = NextResponse.json({ success: true })
    res.cookies.set('budget_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 90, // 90일
      path: '/',
    })
    return res
  }

  return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 })
}
