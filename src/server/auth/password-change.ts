import bcrypt from 'bcryptjs'

export type PasswordChangeDatabase = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: { password: true; passwordChangedAt: true }
    }): Promise<{ password: string | null; passwordChangedAt: Date | null } | null>
    updateMany(args: {
      where: {
        id: string
        password: string | null
        passwordChangedAt: Date | null
      }
      data: {
        password: string
        passwordChangedAt: Date
        activeSessionId: null
        activeSessionExpiresAt: null
        activeSessionId2: null
        activeSessionExpiresAt2: null
        activeSessionId3: null
        activeSessionExpiresAt3: null
      }
    }): Promise<{ count: number }>
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function changePasswordFlow(
  database: PasswordChangeDatabase,
  input: {
    userId: string
    currentPassword: string
    newPassword: string
  },
) {
  const user = await database.user.findUnique({
    where: { id: input.userId },
    select: { password: true, passwordChangedAt: true },
  })
  if (!user) {
    return { success: false as const, error: 'No se pudo encontrar la cuenta.' }
  }

  if (user.password) {
    if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, user.password))) {
      return { success: false as const, error: 'La contraseña actual no es correcta.' }
    }
  }

  const result = await database.user.updateMany({
    where: {
      id: input.userId,
      password: user.password,
      passwordChangedAt: user.passwordChangedAt,
    },
    data: {
      password: await hashPassword(input.newPassword),
      passwordChangedAt: new Date(),
      activeSessionId: null,
      activeSessionExpiresAt: null,
      activeSessionId2: null,
      activeSessionExpiresAt2: null,
      activeSessionId3: null,
      activeSessionExpiresAt3: null,
    },
  })

  if (result.count !== 1) {
    return {
      success: false as const,
      error: 'La contraseña cambió en otra solicitud. Vuelve a intentarlo.',
    }
  }

  return { success: true as const }
}
