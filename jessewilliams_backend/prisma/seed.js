const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@addvancedai.com' },
    update: {},
    create: {
      email: 'admin@addvancedai.com',
      password: adminPassword,
      fullName: 'Admin User',
      role: 'ADMIN',
      emailVerified: true
    }
  });
  console.log('✅ Admin user created:', admin.email);

  // Create second admin user (admin@gmail.com)
  const admin2Password = await bcrypt.hash('admin12345', 10);
  const admin2 = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      password: admin2Password,
      fullName: 'Admin',
      role: 'ADMIN',
      emailVerified: true
    }
  });
  console.log('✅ Secondary admin user created:', admin2.email);

  // Create Deal Hunter GPT
  const dealHunterGpt = await prisma.gptProduct.upsert({
    where: { slug: 'deal-hunter' },
    update: {},
    create: {
      name: 'Deal Hunter GPT',
      slug: 'deal-hunter',
      description: 'AI-powered real estate deal finder and analyzer. Discover profitable investment opportunities with advanced market analysis and deal scoring.',
      features: [
        'Real-time deal discovery',
        'Property analysis & valuation',
        'Market trend insights',
        'Investment scoring',
        'Comparable property analysis',
        'ROI calculator'
      ],
      icon: '🏠',
      gptModel: 'gpt-4',
      systemPrompt: 'You are a real estate investment expert specializing in finding and analyzing profitable deals. Help users identify opportunities, analyze properties, and make informed investment decisions.',
      isFeatured: true,
      order: 1
    }
  });
  console.log('✅ Deal Hunter GPT created');

  // Create Underwriting GPT
  const underwritingGpt = await prisma.gptProduct.upsert({
    where: { slug: 'underwriting-analyzer' },
    update: {},
    create: {
      name: 'Underwriting & Analyzer GPT',
      slug: 'underwriting-analyzer',
      description: 'Comprehensive financial analysis tool for real estate investments. Calculate cash flow, ROI, and validate your investment assumptions.',
      features: [
        'Cash flow analysis',
        'ROI calculations',
        'Financial projections',
        'Risk assessment',
        'Assumption validation',
        'Sensitivity analysis'
      ],
      icon: '📊',
      gptModel: 'gpt-4',
      systemPrompt: 'You are a financial analyst specializing in real estate underwriting. Help users perform detailed financial analysis, calculate returns, and validate investment assumptions.',
      isFeatured: false,
      order: 2
    }
  });
  console.log('✅ Underwriting GPT created');

  // Create Offer/Outreach GPT
  const offerGpt = await prisma.gptProduct.upsert({
    where: { slug: 'offer-outreach' },
    update: {},
    create: {
      name: 'Offer & Outreach GPT',
      slug: 'offer-outreach',
      description: 'Professional communication assistant for real estate deals. Generate LOIs, seller messages, and outreach scripts.',
      features: [
        'LOI generation',
        'Seller outreach scripts',
        'Negotiation templates',
        'Email campaigns',
        'Follow-up sequences',
        'Professional formatting'
      ],
      icon: '✉️',
      gptModel: 'gpt-4',
      systemPrompt: 'You are a real estate communications expert. Help users create professional letters of intent, seller messages, and outreach scripts for real estate deals.',
      isFeatured: false,
      order: 3
    }
  });
  console.log('✅ Offer & Outreach GPT created');

  // Create subscription plans for Deal Hunter
  const dealHunterMonthly = await prisma.subscriptionPlan.create({
    data: {
      name: 'Deal Hunter Monthly',
      description: 'Access to Deal Hunter GPT with monthly billing',
      price: 49.99,
      duration: 'MONTHLY',
      features: [
        'Unlimited deal searches',
        'Advanced analytics',
        'Market insights',
        'Email support'
      ],
      maxRequests: 1000,
      gptProductId: dealHunterGpt.id
    }
  });
  console.log('✅ Deal Hunter Monthly plan created');

  const dealHunterAnnual = await prisma.subscriptionPlan.create({
    data: {
      name: 'Deal Hunter Annual',
      description: 'Access to Deal Hunter GPT with annual billing (save 20%)',
      price: 479.99,
      duration: 'ANNUAL',
      features: [
        'Unlimited deal searches',
        'Advanced analytics',
        'Market insights',
        'Priority support',
        '2 months free'
      ],
      maxRequests: 12000,
      gptProductId: dealHunterGpt.id
    }
  });
  console.log('✅ Deal Hunter Annual plan created');

  // Create bundle plan
  const bundlePlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Complete AI Deal System',
      description: 'Access to all 3 GPTs - Deal Hunter, Underwriting, and Offer/Outreach',
      price: 99.99,
      duration: 'MONTHLY',
      features: [
        'All 3 specialized GPTs',
        'Unlimited usage',
        'Advanced features',
        'Priority support',
        'Weekly market reports'
      ],
      maxRequests: null, // Unlimited
      gptProductId: dealHunterGpt.id
    }
  });
  console.log('✅ Bundle plan created');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
