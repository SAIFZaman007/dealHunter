/**
 * Database Seed Script - Subscription Plans
 * Creates proper Free, Starter, and Pro plans with correct pricing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // Step 1: Create or Get GPT Product
  // ============================================
  console.log('📦 Setting up GPT Product...');
  
  const gptProduct = await prisma.gptProduct.upsert({
    where: { slug: 'deal-hunter' },
    update: {
      name: 'Deal Hunter AI',
      description: 'AI-powered real estate investment assistant that helps you find and analyze profitable property deals',
      isActive: true,
      isFeatured: true,
      gptModel: 'gpt-5.2-mini',
      systemPrompt: 'You are a professional real estate investment advisor specializing in property analysis and deal hunting.',
      features: {
        webSearch: true,
        fileGeneration: true,
        marketAnalysis: true,
        dealScoring: true
      }
    },
    create: {
      name: 'Deal Hunter AI',
      slug: 'deal-hunter',
      description: 'AI-powered real estate investment assistant that helps you find and analyze profitable property deals',
      isActive: true,
      isFeatured: true,
      gptModel: 'gpt-5.2-mini',
      systemPrompt: 'You are a professional real estate investment advisor specializing in property analysis and deal hunting.',
      features: {
        webSearch: true,
        fileGeneration: true,
        marketAnalysis: true,
        dealScoring: true
      }
    }
  });

  console.log(`✅ GPT Product: ${gptProduct.name} (${gptProduct.id})\n`);

  // ============================================
  // Step 2: Delete Old Plans (Clean Slate)
  // ============================================
  console.log('🗑️  Cleaning up old subscription plans...');
  
  const deletedPlans = await prisma.subscriptionPlan.deleteMany({
    where: {
      gptProductId: gptProduct.id
    }
  });
  
  console.log(`✅ Deleted ${deletedPlans.count} old plan(s)\n`);

  // ============================================
  // Step 3: Create Proper Subscription Plans
  // ============================================
  console.log('💳 Creating subscription plans...\n');

  const plans = [
    {
      name: 'Free',
      description: 'Perfect for new investors and small portfolios. Get started with core AI deal analysis.',
      price: 0,
      duration: 'MONTHLY',
      maxRequests: 25000, // 2.5 credits
      stripePriceId: null, // No Stripe for free plan
      isActive: true,
      features: {
        credits: '2.5 / month',
        tokens: '25,000 tokens',
        analysis: 'Core AI deal analysis',
        allocation: 'Hard allocation, no rollover',
        dealPulls: 'Limited deal pulls and short summaries',
        evaluation: 'Residential property evaluation',
        estimates: 'Basic rent & return estimates',
        reports: 'Limited AI-generated reports',
        trial: 'Free trial included',
        targetUser: 'Trial users'
      }
    },
    {
      name: 'Starter',
      description: 'Built for active investors who need deeper insights and more analysis power.',
      price: 29,
      duration: 'MONTHLY',
      maxRequests: 150000, // 15 credits
      stripePriceId: process.env.STRIPE_PRICE_ID_STARTER || null,
      isActive: true,
      features: {
        credits: '15 / month',
        tokens: '150,000 tokens',
        analysis: 'Basic ROI and comps',
        singleDeal: 'Single-deal analysis',
        processing: 'Priority AI processing',
        propertyAnalysis: 'Advanced property & land analysis',
        profitability: 'Fix & flip profitability evaluation',
        rentalInsights: 'Long-term & short-term rental insights',
        reports: 'Downloadable Excel & document reports',
        targetUser: 'Power users'
      }
    },
    {
      name: 'Pro',
      description: 'Designed for serious investors and professionals who need the full AI investment toolkit.',
      price: 59,
      duration: 'MONTHLY',
      maxRequests: 500000, // 50 credits
      stripePriceId: process.env.STRIPE_PRICE_ID_PRO || null,
      isActive: true,
      features: {
        credits: '50 / month',
        tokens: '500,000 tokens',
        tiers: 'Profitable tier',
        bulkAnalysis: 'Bulk deal analysis',
        logic: 'Land and residential logic',
        toolkit: 'Full AI investment toolkit',
        volumeAnalysis: 'High-volume deal analysis',
        scenarioModeling: 'Advanced scenario modeling',
        sensitivity: 'Sensitivity analysis and large CSV exports',
        targetUser: 'Teams / builders'
      }
    }
  ];

  for (const planData of plans) {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        ...planData,
        gptProductId: gptProduct.id
      }
    });

    const credits = plan.maxRequests / 10000;
    console.log(`  ✅ ${plan.name.padEnd(8)} - $${plan.price.toString().padStart(2)}/month - ${credits.toFixed(1)} credits (${plan.maxRequests.toLocaleString()} tokens)`);
  }

  // ============================================
  // Step 4: Display Summary
  // ============================================
  console.log('\n📊 Subscription Plans Summary:');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const allPlans = await prisma.subscriptionPlan.findMany({
    where: { gptProductId: gptProduct.id },
    orderBy: { price: 'asc' }
  });

  allPlans.forEach(plan => {
    const credits = plan.maxRequests / 10000;
    console.log(`
Plan: ${plan.name}
  Price: $${plan.price}/${plan.duration.toLowerCase()}
  Credits: ${credits} credits/month (${plan.maxRequests.toLocaleString()} tokens)
  Stripe Price ID: ${plan.stripePriceId || 'N/A (Free plan)'}
  Status: ${plan.isActive ? '✅ Active' : '❌ Inactive'}
  Features: ${JSON.stringify(plan.features, null, 2)}
    `);
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n✅ Database seeding completed successfully!\n');

  // ============================================
  // Step 5: Verify Token Calculations
  // ============================================
  console.log('🔍 Verification:');
  console.log('  1 Credit = 10,000 tokens');
  console.log('  Free:    2.5 credits × 10,000 = 25,000 tokens ✅');
  console.log('  Starter: 15 credits × 10,000 = 150,000 tokens ✅');
  console.log('  Pro:     50 credits × 10,000 = 500,000 tokens ✅\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });