const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.transaction.findMany({
      select: {
        id: true,
        date: true,
        type: true,
        amount: true,
        currency: true,
        account: { select: { name: true, type: true } },
      },
      orderBy: { date: 'desc' },
      take: 30,
    })
    console.log(JSON.stringify(rows, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
