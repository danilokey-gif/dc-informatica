'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/session"

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    }
  })

  redirect('/usuarios')
}

export async function updateUser(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const role = formData.get('role') as string
  const novaSenha = formData.get('password') as string

  await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role,
      ...(novaSenha ? { passwordHash: await bcrypt.hash(novaSenha, 10) } : {}),
    }
  })

  redirect('/usuarios')
}

export async function deleteUser(id: string) {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('auth_token')?.value)

  if (session?.userId === id) {
    throw new Error('Você não pode excluir seu próprio usuário.')
  }

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id } })
  if (usuario.role === 'ADMIN') {
    const totalAdmins = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (totalAdmins <= 1) {
      throw new Error('Não é possível excluir o único administrador do sistema.')
    }
  }

  await prisma.user.delete({ where: { id } })
  revalidatePath('/usuarios')
}
