'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signSession } from '@/lib/session'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Para fins de demonstração, criaremos um admin inicial se o banco estiver vazio.
  const userCount = await prisma.user.count()
  if (userCount === 0) {
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@dcinformatica.com',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'ADMIN'
      }
    })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false

  console.log('[loginAction debug]', { email, userFound: !!user, passwordMatches, userCount })

  if (user && passwordMatches) {
    const cookieStore = await cookies()
    const token = await signSession(user.id)
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
