import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clear existing data
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.product.deleteMany()

  // Seed users (for role resolution when using external auth)
  for (const u of [
    { email: 'admin@example.com', role: 'admin' },
    { email: 'admin-readonly@example.com', role: 'admin' },
    { email: 'user1@example.com', role: 'user' },
    { email: 'user2@example.com', role: 'user' },
  ]) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { email: u.email, role: u.role },
    })
  }
  console.log('Created demo users (2 admin + 2 user)')

  // Seed products (matching data/products.json)
  const products = await prisma.product.createMany({
    data: [
      { id: 'p1', name: 'デジタルカメラ', price: 1200, description: '高画質コンパクトデジタルカメラ', imageUrl: '/products/digital-camera.jpg' },
      { id: 'p2', name: 'ワイヤレスイヤホン', price: 2300, description: 'Bluetooth対応ワイヤレスイヤホン', imageUrl: '/products/wireless-earphone.jpg' },
      { id: 'p3', name: 'フルーツジャム', price: 500, description: '国産果実使用の手作りジャム', imageUrl: '/products/fruit-jam.jpg' },
      { id: 'p4', name: 'リップクリーム', price: 3800, description: '保湿成分配合リップクリーム', imageUrl: '/products/lip-cream.jpg' },
      { id: 'p5', name: 'ノートPC', price: 1500, description: '軽量薄型ノートパソコン', imageUrl: '/products/laptop.jpg' },
      { id: 'p6', name: 'ランニングシューズ', price: 4200, description: '軽量クッション搭載ランニングシューズ', imageUrl: '/products/running-shoes.jpg' },
      { id: 'p7', name: 'サングラス', price: 2800, description: 'UV400カット偏光サングラス', imageUrl: '/products/sunglasses.jpg' },
      { id: 'p8', name: '腕時計', price: 960, description: '防水機能付きアナログ腕時計', imageUrl: '/products/wrist-watch.jpg' },
    ],
  })

  console.log(`Created ${products.count} products`)
  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
