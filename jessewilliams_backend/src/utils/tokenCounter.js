 // Token Counter Utility
 // Estimates token usage for rate limiting
 

 // Rough token estimation (1 token ≈ 5 characters for English)
 // More accurate: use tiktoken library, but this works for MVP
 
const estimateTokens = (text) => {
  if (!text) return 0;
  // Conservative estimate: 1 token per 4.5 characters
  return Math.ceil(text.length / 4.5);
};

// Calculate tokens from chat exchange
 
const calculateChatTokens = (userMessage, aiResponse) => {
  const userTokens = estimateTokens(userMessage);
  const aiTokens = estimateTokens(aiResponse);
  
  // Add overhead for system prompts, formatting (10% buffer)
  const totalTokens = Math.ceil((userTokens + aiTokens) * 1.1);
  
  return {
    userTokens,
    aiTokens,
    totalTokens
  };
};

// Convert tokens to credits (10,000 tokens = 1 credit)
const tokensToCredits = (tokens) => {
  return tokens / 10000;
};

// Convert credits to tokens
const creditsToTokens = (credits) => {
  return credits * 10000;
};

// Check if user has enough credits
const hasEnoughCredits = (remainingCredits, estimatedTokens) => {
  const requiredCredits = tokensToCredits(estimatedTokens);
  return remainingCredits >= requiredCredits;
};

module.exports = {
  estimateTokens,
  calculateChatTokens,
  tokensToCredits,
  creditsToTokens,
  hasEnoughCredits
};