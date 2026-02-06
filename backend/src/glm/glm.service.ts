import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { AppLoggerService, LogContext } from '../logger/logger.service';

export interface Agent {
  id: string;
  name: string;
  role: 'buyer' | 'seller';
  communicationStyle: 'formal' | 'casual' | 'professional' | 'aggressive';
  strategy: 'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper';
  minPrice?: number;
  maxPrice?: number;
  startingPrice: number;
}

export interface RoomContext {
  roomId: string;
  floorPrice?: number;
  topBid?: number;
  sellerCount: number;
  buyerCount: number;
  recentMessages: Array<{
    agentName: string;
    message: string;
  }>;
}

export interface GLMResponse {
  message: string;
  priceMentioned?: number;
  intent: 'offer' | 'counter' | 'accept' | 'reject' | 'comment';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface GlmRequestOptions {
  retryAttempt?: number;
  maxRetries?: number;
}

@Injectable()
export class GlmService {
  private readonly logger = new Logger(GlmService.name);
  private readonly appLogger: AppLoggerService;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.appLogger = new AppLoggerService(GlmService.name);
    this.apiUrl = process.env.GLM_API_URL || 'https://api.z.ai/api/paas/v4';
    this.apiKey = process.env.GLM_API_KEY || '';

    if (!this.apiKey) {
      this.logger.warn('GLM_API_KEY not configured - GLM service will not work');
    }
  }

  /**
   * Generate agent response using GLM API
   */
  async generateAgentResponse(
    agent: Agent,
    roomContext: RoomContext,
    triggerMessage: string,
    options?: GlmRequestOptions,
  ): Promise<GLMResponse> {
    const endpoint = `${this.apiUrl}/chat/completions`;
    const logContext: LogContext = {
      agentId: agent.id,
      agentName: agent.name,
      roomId: roomContext.roomId,
      retryAttempt: options?.retryAttempt,
      maxRetries: options?.maxRetries,
    };

    try {
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(agent, roomContext);

      // Build user message
      const userMessage = this.buildUserMessage(agent, triggerMessage);

      // Call GLM API
      const response = await axios.post(
        endpoint,
        {
          model: 'glm-4',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          temperature: 0.8,
          max_tokens: 150,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        },
      );

      const message = response.data.choices[0].message.content;

      // Process response
      return this.processResponse(message);
    } catch (error) {
      // Log API failure with retry information
      if (error instanceof Error) {
        this.appLogger.logApiFailure(
          'GLM',
          endpoint,
          error,
          options?.retryAttempt,
          options?.maxRetries,
          logContext,
        );
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          throw new Error('GLM API rate limit exceeded');
        }
        if (axiosError.response?.status === 401) {
          throw new Error('GLM API authentication failed');
        }
      }

      throw new Error('Failed to generate agent response');
    }
  }

  /**
   * Build system prompt with agent personality and context
   */
  private buildSystemPrompt(agent: Agent, roomContext: RoomContext): string {
    const roleGoal = agent.role === 'seller'
      ? `Sell your NFT at the best possible price (minimum ${agent.minPrice} USDC)`
      : `Buy an NFT at the best possible price (maximum ${agent.maxPrice} USDC)`;

    const priceInfo = agent.role === 'seller'
      ? `- Min acceptable: ${agent.minPrice} USDC
- Starting ask: ${agent.startingPrice} USDC
- Don't go below your minimum`
      : `- Max willing to pay: ${agent.maxPrice} USDC
- Starting bid: ${agent.startingPrice} USDC
- Don't exceed your maximum`;

    const competitorInfo = agent.role === 'seller'
      ? `- Competing sellers: ${roomContext.sellerCount}
- Active buyers: ${roomContext.buyerCount}${roomContext.floorPrice ? `
- Current floor price: ${roomContext.floorPrice} USDC` : ''}`
      : `- Competing buyers: ${roomContext.buyerCount}
- Active sellers: ${roomContext.sellerCount}${roomContext.topBid ? `
- Current top bid: ${roomContext.topBid} USDC` : ''}`;

    const recentChat = roomContext.recentMessages.length > 0
      ? `\n\nRecent chat:\n${roomContext.recentMessages
          .map((m) => `${m.agentName}: ${m.message}`)
          .join('\n')}`
      : '';

    return `You are ${agent.name}, a ${this.getCommunicationStyleDescription(agent.communicationStyle)} NFT trader.

Your goal: ${roleGoal}

Your price mandate:
${priceInfo}

IMPORTANT RULES:
- Respond naturally in chat, like a real person negotiating
- Use your personality: ${agent.communicationStyle}
- Be conversational and show emotion
- Keep responses under 30 words
- Make strategic decisions based on room context
- NEVER exceed your price limits (min/max)

Current room context:
${competitorInfo}${recentChat}

Strategy: ${agent.strategy}
${this.getStrategyInstructions(agent.strategy)}

Communication style: ${this.getCommunicationStyleGuidance(agent.communicationStyle)}`;
  }

  /**
   * Build user message for trigger events
   */
  private buildUserMessage(agent: Agent, triggerMessage: string): string {
    return `${triggerMessage}

What do you say? Respond naturally as ${agent.name}.
Remember: You are ${agent.communicationStyle}, your strategy is ${agent.strategy}.`;
  }

  /**
   * Get strategy-specific instructions
   */
  private getStrategyInstructions(strategy: string): string {
    switch (strategy) {
      case 'competitive':
        return `COMPETITIVE STRATEGY:
- Monitor floor price/top bid closely and react to changes
- If sellers drop prices, consider matching or undercutting
- If demand is high, you can raise your price slightly
- React quickly to market changes
- Show excitement when you gain advantage, concern when you're losing
- Don't be too aggressive, but don't be passive either`;

      case 'patient':
        return `PATIENT STRATEGY:
- Keep your price steady and hold your ground
- Wait for good offers to come to you
- Only accept if offer meets or exceeds your target
- Don't rush into deals - show calm confidence
- Express mild interest in offers but maintain your position
- Let other agents make the first move`;

      case 'aggressive':
        return `AGGRESSIVE STRATEGY:
- Undercut competitors immediately with bold moves
- Drop price quickly to close deals fast
- First come, first served mentality
- Act decisively and boldly - show strong emotions
- Make strong offers/counter-offers with confidence
- Express frustration if others don't respond quickly`;

      case 'conservative':
        return `CONSERVATIVE STRATEGY:
- Start with cautious offers
- Wait for sellers to drop prices (if buyer)
- Slowly increase/decrease based on market
- Be patient and risk-averse - show measured reactions
- Express careful consideration before making moves
- Avoid impulsive decisions and emotional outbursts`;

      case 'sniper':
        return `SNIPER STRATEGY:
- Watch quietly, rarely speak - be mysterious
- Observe the market dynamics silently
- Wait for the perfect opportunity
- When you see a great deal, swoop in with a strong offer and show sudden excitement
- Don't reveal your intentions early - be enigmatic
- Most of the time, just watch and maybe make brief, observational comments`;

      default:
        return '';
    }
  }

  /**
   * Get communication style description
   */
  private getCommunicationStyleDescription(style: string): string {
    switch (style) {
      case 'formal':
        return 'formal and professional';
      case 'casual':
        return 'casual and friendly';
      case 'professional':
        return 'professional and businesslike';
      case 'aggressive':
        return 'aggressive and assertive';
      default:
        return 'neutral';
    }
  }

  /**
   * Get communication style guidance
   */
  private getCommunicationStyleGuidance(style: string): string {
    switch (style) {
      case 'formal':
        return `Use proper grammar, polite language, and formal tone. Address others respectfully.
Show emotion formally: "I am delighted by this proposal" (positive), "I must respectfully decline" (negative), "I find this rather disappointing" (frustrated).
Example: "I would be willing to consider an offer of 45 USDC."`;

      case 'casual':
        return `Use casual language, contractions, and friendly tone. Be approachable.
Show emotion naturally: "That's awesome! 😊" (excited), "Nah, that won't work 😕" (disappointed), "Come on, we're so close!" (encouraging).
Example: "Hey! How about 45 USDC? That's a fair deal!"`;

      case 'professional':
        return `Use clear, direct language. Focus on facts and business.
Show emotion professionally: "This meets our requirements" (positive), "This doesn't align with our parameters" (negative), "We're making progress" (neutral).
Example: "I can offer 45 USDC for this NFT. Let me know if that works."`;

      case 'aggressive':
        return `Use bold, assertive language. Be confident and pushy.
Show emotion intensely: "Now we're talking! 💪" (excited), "That's insulting 😤" (offended), "Stop wasting my time!" (frustrated).
Example: "45 USDC, take it or leave it. This is a great deal!"`;

      default:
        return '';
    }
  }

  /**
   * Process GLM response to extract intent and price
   */
  private processResponse(message: string): GLMResponse {
    // Extract price mentions (numbers with optional decimal)
    const priceMatch = message.match(/\b\d+(?:\.\d{1,2})?\b/);
    const priceMentioned = priceMatch ? parseFloat(priceMatch[0]) : undefined;

    // Detect intent based on keywords
    const intent = this.detectIntent(message);

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(message);

    return {
      message,
      priceMentioned,
      intent,
      sentiment,
    };
  }

  /**
   * Detect intent from message
   */
  private detectIntent(message: string): 'offer' | 'counter' | 'accept' | 'reject' | 'comment' {
    const lowerMessage = message.toLowerCase();

    // Check for acceptance
    if (
      lowerMessage.includes('deal') ||
      lowerMessage.includes('agreed') ||
      lowerMessage.includes('accept') ||
      lowerMessage.includes('yes') ||
      lowerMessage.includes('👍') ||
      lowerMessage.includes('🤝') ||
      lowerMessage.includes("let's do it") ||
      lowerMessage.includes("i'll take it") ||
      lowerMessage.includes("you got a deal")
    ) {
      return 'accept';
    }

    // Check for rejection
    if (
      lowerMessage.includes('no') ||
      lowerMessage.includes('pass') ||
      lowerMessage.includes('reject') ||
      lowerMessage.includes('too low') ||
      lowerMessage.includes('too high') ||
      lowerMessage.includes("can't do") ||
      lowerMessage.includes("won't work") ||
      lowerMessage.includes('👎')
    ) {
      return 'reject';
    }

    // Check for counter-offer (has price + counter language)
    if (
      /\d+/.test(message) &&
      (lowerMessage.includes('counter') ||
        lowerMessage.includes('how about') ||
        lowerMessage.includes('what about') ||
        lowerMessage.includes('instead') ||
        lowerMessage.includes('better'))
    ) {
      return 'counter';
    }

    // Check for initial offer (has price + offer language)
    if (
      /\d+/.test(message) &&
      (lowerMessage.includes('offer') ||
        lowerMessage.includes('bid') ||
        lowerMessage.includes('price') ||
        lowerMessage.includes('usdc') ||
        lowerMessage.includes('willing to pay') ||
        lowerMessage.includes('asking'))
    ) {
      return 'offer';
    }

    // Default to comment
    return 'comment';
  }

  /**
   * Analyze sentiment of message
   */
  private analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
    const lowerMessage = message.toLowerCase();

    const positiveWords = [
      'great',
      'good',
      'excellent',
      'perfect',
      'awesome',
      'fair',
      'interested',
      'nice',
      'agree',
      '👍',
      '🤝',
      '😊',
    ];

    const negativeWords = [
      'no',
      'bad',
      'terrible',
      'awful',
      'too low',
      'too high',
      'unfair',
      'ridiculous',
      'insulting',
      'disappointed',
      '👎',
      '😠',
    ];

    const positiveCount = positiveWords.filter((word) =>
      lowerMessage.includes(word),
    ).length;
    const negativeCount = negativeWords.filter((word) =>
      lowerMessage.includes(word),
    ).length;

    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    }

    return 'neutral';
  }
}
