const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('./email.service');

/**
 * Generate JWT token (15 days expiry)
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15d'
  });
};

/**
 * Register user and send OTP
 */
const registerUser = async ({ email, password, fullName }) => {
  // Validation
  if (!email || !password) {
    throw new Error('Please provide email and password');
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Create user (unverified)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName,
      emailVerified: false,
      verificationToken: otp,
      verificationTokenExpiry: otpExpiry
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      emailVerified: true,
      createdAt: true
    }
  });

  // Send OTP email
  await sendOTPEmail(email, otp, fullName);

  return user;
};

/**
 * Auto-subscribe new user to Free plan
 * Called after email verification
 */
const autoSubscribeFreePlan = async (userId) => {
  try {
    // 1. Find the Free plan
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: {
        price: 0,
        isActive: true,
        name: {
          contains: 'Free',
          mode: 'insensitive'
        }
      }
    });

    if (!freePlan) {
      console.error('❌ Free plan not found! Skipping auto-subscription.');
      return null;
    }

    // 2. Check if user already has a subscription
    const existingSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      }
    });

    if (existingSubscription) {
      console.log('ℹ️  User already has an active subscription, skipping Free plan');
      return existingSubscription;
    }

    // 3. Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    if (freePlan.duration === 'MONTHLY') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (freePlan.duration === 'ANNUAL') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // For Free plan with no expiry, set far future date
      endDate.setFullYear(endDate.getFullYear() + 100);
    }

    // 4. Create Free plan subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: 'ACTIVE',
        startDate,
        endDate,
        requestsUsed: 0,
        lastResetDate: startDate
      },
      include: {
        plan: {
          select: {
            name: true,
            maxRequests: true
          }
        }
      }
    });

    console.log(`✅ Auto-subscribed user ${userId} to Free plan (${freePlan.maxRequests} tokens)`);
    
    return subscription;
  } catch (error) {
    console.error('❌ Error auto-subscribing to Free plan:', error);
    // Don't throw - registration should still succeed even if auto-subscription fails
    return null;
  }
};

/**
 * Verify OTP and complete registration
 */
const verifyOTP = async (email, otp) => {
  const user = await prisma.user.findUnique({ 
    where: { email } 
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.emailVerified) {
    throw new Error('Email already verified');
  }

  if (!user.verificationToken || user.verificationToken !== otp) {
    throw new Error('Invalid OTP');
  }

  if (new Date() > user.verificationTokenExpiry) {
    throw new Error('OTP has expired');
  }

  // Verify user
  const verifiedUser = await prisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      emailVerified: true
    }
  });

  // AUTO-SUBSCRIBE TO FREE PLAN
  await autoSubscribeFreePlan(verifiedUser.id);

  // Send welcome email
  await sendWelcomeEmail(email, verifiedUser.fullName || 'User');

  // Generate token
  const token = generateToken(verifiedUser.id);

  return { user: verifiedUser, token };
};

/**
 * Resend OTP
 */
const resendOTP = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.emailVerified) {
    throw new Error('Email already verified');
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Update user
  await prisma.user.update({
    where: { email },
    data: {
      verificationToken: otp,
      verificationTokenExpiry: otpExpiry
    }
  });

  // Send OTP email
  await sendOTPEmail(email, otp, user.fullName);

  return { success: true };
};

/**
 * Login user
 */
const loginUser = async (email, password) => {
  // Find user
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Check if email is verified
  if (!user.emailVerified) {
    throw new Error('Please verify your email first');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  // ENSURE USER HAS FREE PLAN (safety net)
  // In case verification happened but subscription failed
  const hasSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE'
    }
  });

  if (!hasSubscription) {
    console.log('⚠️  User has no active subscription, auto-subscribing to Free plan...');
    await autoSubscribeFreePlan(user.id);
  }

  // Generate token
  const token = generateToken(user.id);

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  generateToken,
  autoSubscribeFreePlan
};