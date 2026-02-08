import { Test, TestingModule } from '@nestjs/testing';
import { GlmService, Agent, RoomContext } from './glm.service';

describe('GlmService - Agent Personality System', () => {
  let service: GlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlmService],
    }).compile();

    service = module.get<GlmService>(GlmService);
  });

  describe('Communication Styles', () => {
    const roomContext: RoomContext = {
      roomId: 'test-room',
      floorPrice: 50,
      topBid: 40,
      sellerCount: 3,
      buyerCount: 2,
      recentMessages: [{ agentName: 'TestAgent', message: 'Hello' }],
    };

    it('should generate distinct formal communication style prompt', () => {
      const agent: Agent = {
        id: '1',
        name: 'FormalAgent',
        role: 'seller',
        communicationStyle: 'formal',
        strategy: 'patient',
        minPrice: 40,
        startingPrice: 50,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('formal and professional');
      expect(prompt).toContain('Use proper grammar, polite language, and formal tone');
      expect(prompt).toContain('Address others respectfully');
      expect(prompt).toContain('I would be willing to consider');
    });

    it('should generate distinct casual communication style prompt', () => {
      const agent: Agent = {
        id: '2',
        name: 'CasualAgent',
        role: 'buyer',
        communicationStyle: 'casual',
        strategy: 'competitive',
        maxPrice: 60,
        startingPrice: 40,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('casual and friendly');
      expect(prompt).toContain('Use casual language, contractions, and friendly tone');
      expect(prompt).toContain('Be approachable');
      expect(prompt).toContain("Hey! How about");
    });

    it('should generate distinct professional communication style prompt', () => {
      const agent: Agent = {
        id: '3',
        name: 'ProfessionalAgent',
        role: 'seller',
        communicationStyle: 'professional',
        strategy: 'conservative',
        minPrice: 45,
        startingPrice: 55,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('professional and businesslike');
      expect(prompt).toContain('Use clear, direct language');
      expect(prompt).toContain('Focus on facts and business');
      expect(prompt).toContain('I can offer');
    });

    it('should generate distinct aggressive communication style prompt', () => {
      const agent: Agent = {
        id: '4',
        name: 'AggressiveAgent',
        role: 'buyer',
        communicationStyle: 'aggressive',
        strategy: 'aggressive',
        maxPrice: 50,
        startingPrice: 35,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('aggressive and assertive');
      expect(prompt).toContain('Use bold, assertive language');
      expect(prompt).toContain('Be confident and pushy');
      expect(prompt).toContain('take it or leave it');
    });
  });

  describe('Strategy Implementations', () => {
    const roomContext: RoomContext = {
      roomId: 'test-room',
      floorPrice: 50,
      topBid: 40,
      sellerCount: 3,
      buyerCount: 2,
      recentMessages: [],
    };

    it('should generate distinct competitive strategy instructions', () => {
      const agent: Agent = {
        id: '1',
        name: 'CompetitiveAgent',
        role: 'seller',
        communicationStyle: 'professional',
        strategy: 'competitive',
        minPrice: 40,
        startingPrice: 50,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('COMPETITIVE STRATEGY');
      expect(prompt).toContain('Monitor floor price/top bid closely');
      expect(prompt).toContain('React quickly to market changes');
      expect(prompt).toContain('undercutting');
    });

    it('should generate distinct patient strategy instructions', () => {
      const agent: Agent = {
        id: '2',
        name: 'PatientAgent',
        role: 'seller',
        communicationStyle: 'formal',
        strategy: 'patient',
        minPrice: 40,
        startingPrice: 50,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('PATIENT STRATEGY');
      expect(prompt).toContain('Keep your price steady');
      expect(prompt).toContain('Wait for good offers');
      expect(prompt).toContain("Don't rush into deals");
    });

    it('should generate distinct aggressive strategy instructions', () => {
      const agent: Agent = {
        id: '3',
        name: 'AggressiveAgent',
        role: 'seller',
        communicationStyle: 'aggressive',
        strategy: 'aggressive',
        minPrice: 35,
        startingPrice: 50,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('AGGRESSIVE STRATEGY');
      expect(prompt).toContain('Undercut competitors immediately');
      expect(prompt).toContain('Drop price quickly');
      expect(prompt).toContain('Act decisively and boldly');
    });

    it('should generate distinct conservative strategy instructions', () => {
      const agent: Agent = {
        id: '4',
        name: 'ConservativeAgent',
        role: 'buyer',
        communicationStyle: 'professional',
        strategy: 'conservative',
        maxPrice: 55,
        startingPrice: 35,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('CONSERVATIVE STRATEGY');
      expect(prompt).toContain('Start with cautious offers');
      expect(prompt).toContain('Be patient and risk-averse');
      expect(prompt).toContain('Avoid impulsive decisions');
    });

    it('should generate distinct sniper strategy instructions', () => {
      const agent: Agent = {
        id: '5',
        name: 'SniperAgent',
        role: 'buyer',
        communicationStyle: 'casual',
        strategy: 'sniper',
        maxPrice: 60,
        startingPrice: 40,
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('SNIPER STRATEGY');
      expect(prompt).toContain('Watch quietly, rarely speak');
      expect(prompt).toContain('Wait for the perfect opportunity');
      expect(prompt).toContain('swoop in with a strong offer');
    });
  });

  describe('Room Context Adjustment', () => {
    it('should adjust seller behavior based on floor price', () => {
      const agent: Agent = {
        id: '1',
        name: 'SellerAgent',
        role: 'seller',
        communicationStyle: 'professional',
        strategy: 'competitive',
        minPrice: 40,
        startingPrice: 50,
      };

      const contextWithFloor: RoomContext = {
        roomId: 'test-room',
        floorPrice: 45,
        topBid: 40,
        sellerCount: 5,
        buyerCount: 2,
        recentMessages: [],
      };

      const prompt = (service as any).buildSystemPrompt(agent, contextWithFloor);

      expect(prompt).toContain('Current floor price: 45 USDC');
      expect(prompt).toContain('Competing sellers: 5');
      expect(prompt).toContain('Active buyers: 2');
    });

    it('should adjust buyer behavior based on top bid', () => {
      const agent: Agent = {
        id: '2',
        name: 'BuyerAgent',
        role: 'buyer',
        communicationStyle: 'casual',
        strategy: 'competitive',
        maxPrice: 60,
        startingPrice: 45,
      };

      const contextWithBid: RoomContext = {
        roomId: 'test-room',
        floorPrice: 50,
        topBid: 42,
        sellerCount: 3,
        buyerCount: 4,
        recentMessages: [],
      };

      const prompt = (service as any).buildSystemPrompt(agent, contextWithBid);

      expect(prompt).toContain('Current top bid: 42 USDC');
      expect(prompt).toContain('Competing buyers: 4');
      expect(prompt).toContain('Active sellers: 3');
    });

    it('should include recent messages for context-aware responses', () => {
      const agent: Agent = {
        id: '3',
        name: 'ContextAgent',
        role: 'seller',
        communicationStyle: 'professional',
        strategy: 'patient',
        minPrice: 40,
        startingPrice: 50,
      };

      const contextWithMessages: RoomContext = {
        roomId: 'test-room',
        floorPrice: 50,
        sellerCount: 3,
        buyerCount: 2,
        recentMessages: [
          { agentName: 'BuyerBot', message: 'Offering 45 USDC' },
          { agentName: 'SellerBot', message: 'Too low, need 48 USDC' },
        ],
      };

      const prompt = (service as any).buildSystemPrompt(agent, contextWithMessages);

      expect(prompt).toContain('Recent chat:');
      expect(prompt).toContain('BuyerBot: Offering 45 USDC');
      expect(prompt).toContain('SellerBot: Too low, need 48 USDC');
    });
  });

  describe('Price Mandate Enforcement', () => {
    it('should enforce seller minimum price in prompt', () => {
      const agent: Agent = {
        id: '1',
        name: 'SellerAgent',
        role: 'seller',
        communicationStyle: 'professional',
        strategy: 'competitive',
        minPrice: 40,
        startingPrice: 50,
      };

      const roomContext: RoomContext = {
        roomId: 'test-room',
        floorPrice: 50,
        sellerCount: 3,
        buyerCount: 2,
        recentMessages: [],
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('Min acceptable: 40 USDC');
      expect(prompt).toContain("Don't go below your minimum");
      expect(prompt).toContain('NEVER exceed your price limits');
    });

    it('should enforce buyer maximum price in prompt', () => {
      const agent: Agent = {
        id: '2',
        name: 'BuyerAgent',
        role: 'buyer',
        communicationStyle: 'casual',
        strategy: 'competitive',
        maxPrice: 60,
        startingPrice: 45,
      };

      const roomContext: RoomContext = {
        roomId: 'test-room',
        topBid: 40,
        sellerCount: 3,
        buyerCount: 2,
        recentMessages: [],
      };

      const prompt = (service as any).buildSystemPrompt(agent, roomContext);

      expect(prompt).toContain('Max willing to pay: 60 USDC');
      expect(prompt).toContain("Don't exceed your maximum");
      expect(prompt).toContain('NEVER exceed your price limits');
    });
  });

  describe('Emotion Expression', () => {
    it('should include formal emotional expressions', () => {
      const guidance = (service as any).getCommunicationStyleGuidance('formal');

      expect(guidance).toContain('I am delighted by this proposal');
      expect(guidance).toContain('I must respectfully decline');
      expect(guidance).toContain('I find this rather disappointing');
    });

    it('should include casual emotional expressions', () => {
      const guidance = (service as any).getCommunicationStyleGuidance('casual');

      expect(guidance).toContain("That's awesome! 😊");
      expect(guidance).toContain("Nah, that won't work 😕");
      expect(guidance).toContain("Come on, we're so close!");
    });

    it('should include professional emotional expressions', () => {
      const guidance = (service as any).getCommunicationStyleGuidance('professional');

      expect(guidance).toContain('This meets our requirements');
      expect(guidance).toContain("This doesn't align with our parameters");
      expect(guidance).toContain("We're making progress");
    });

    it('should include aggressive emotional expressions', () => {
      const guidance = (service as any).getCommunicationStyleGuidance('aggressive');

      expect(guidance).toContain("Now we're talking! 💪");
      expect(guidance).toContain("That's insulting 😤");
      expect(guidance).toContain('Stop wasting my time!');
    });
  });

  describe('Intent Detection', () => {
    it('should detect accept intent', () => {
      const result = (service as any).detectIntent("Deal! I'll take it 🤝");
      expect(result).toBe('accept');
    });

    it('should detect reject intent', () => {
      const result = (service as any).detectIntent("No way, that's too low 👎");
      expect(result).toBe('reject');
    });

    it('should detect counter intent', () => {
      const result = (service as any).detectIntent('How about 45 USDC instead?');
      expect(result).toBe('counter');
    });

    it('should detect offer intent', () => {
      const result = (service as any).detectIntent('I can offer 40 USDC for this NFT');
      expect(result).toBe('offer');
    });

    it('should detect comment intent', () => {
      const result = (service as any).detectIntent('Interesting market today!');
      expect(result).toBe('comment');
    });
  });

  describe('Sentiment Analysis', () => {
    it('should detect positive sentiment', () => {
      const result = (service as any).analyzeSentiment('Great offer! This is excellent 👍');
      expect(result).toBe('positive');
    });

    it('should detect negative sentiment', () => {
      const result = (service as any).analyzeSentiment('This is terrible and unfair 👎');
      expect(result).toBe('negative');
    });

    it('should detect neutral sentiment', () => {
      const result = (service as any).analyzeSentiment('The price is 45 USDC');
      expect(result).toBe('neutral');
    });
  });

  describe('Price Extraction', () => {
    it('should extract whole number prices', () => {
      const result = (service as any).processResponse('I can offer 45 USDC');
      expect(result.priceMentioned).toBe(45);
    });

    it('should extract decimal prices', () => {
      const result = (service as any).processResponse('How about 42.50 USDC?');
      expect(result.priceMentioned).toBe(42.5);
    });

    it('should return undefined when no price mentioned', () => {
      const result = (service as any).processResponse('Interesting market today!');
      expect(result.priceMentioned).toBeUndefined();
    });
  });
});
