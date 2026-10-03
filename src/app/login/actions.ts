'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signSession } from '@/lib/session'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Não existe mais criação automática de administrador com senha padrão: o código é público no
  // GitHub, então qualquer pessoa conheceria a senha se o banco ficasse vazio algum dia.
  const user = await prisma.user.findUnique({ where: { email } })
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false

  if (user && passwordMatches) {
    const cookieStore = await cookies()
    const token = await signSession(user.id, user.role)
    cookieStore.set('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' })
    redirect('/')
  } else {
    redirect('/login?error=1')
  }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
  redirect('/login')
}
