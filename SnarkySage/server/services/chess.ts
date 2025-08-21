// Chess engine service using Stockfish
import { spawn, ChildProcess } from 'child_process';

interface ChessGameState {
  board: string; // FEN notation
  moves: string[];
  gameOver: boolean;
  winner?: 'white' | 'black' | 'draw';
}

interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
  san: string; // Standard Algebraic Notation
}

export class ChessEngine {
  private stockfish: ChildProcess | null = null;
  private isReady: boolean = false;
  private gameState: ChessGameState;

  constructor() {
    this.gameState = {
      board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
      moves: [],
      gameOver: false
    };
    // Removed the direct call to initStockfish and instead added a check in initializeStockfish.
    // The constructor now relies on initializeStockfish being called and setting isReady.
  }

  private async initializeStockfish(): Promise<void> {
    try {
      // Check if stockfish is available before trying to spawn
      const { spawn: testSpawn } = await import('child_process');
      const testProcess = testSpawn('which', ['stockfish']);

      testProcess.on('error', () => {
        console.log('Stockfish not available, using fallback AI');
        this.isReady = false;
        return;
      });

      testProcess.on('exit', (code) => {
        if (code === 0) {
          // Stockfish is available, proceed with initialization
          this.startStockfish();
        } else {
          console.log('Stockfish not found in PATH, using fallback AI');
          this.isReady = false;
        }
      });

    } catch (error) {
      console.error('Stockfish initialization check failed:', error);
      this.isReady = false;
    }
  }

  private startStockfish(): void {
    try {
      this.stockfish = spawn('stockfish');

      this.stockfish.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('uciok')) {
          this.isReady = true;
          console.log('Stockfish initialized successfully');
        }
      });

      this.stockfish.stderr?.on('data', (data: Buffer) => {
        console.error('Stockfish error:', data.toString());
      });

      this.stockfish.on('error', (error: Error) => {
        console.error('Stockfish spawn error:', error);
        this.isReady = false;
      });

      this.stockfish.on('close', (code: number) => {
        console.log(`Stockfish exited with code ${code}`);
        this.isReady = false;
      });

      // Send UCI command to initialize
      if (this.stockfish.stdin) {
        this.stockfish.stdin.write('uci\n');
      }

    } catch (error) {
      console.error('Failed to start Stockfish:', error);
      this.isReady = false;
    }
  }

  public async makeMove(move: string): Promise<{ success: boolean, aiMove?: string | undefined, gameState: ChessGameState, message?: string }> {
    try {
      // Validate and make the user's move
      if (!this.isValidMove(move)) {
        return {
          success: false,
          gameState: this.gameState,
          message: "Invalid move! Please use algebraic notation like 'e2e4' or 'Nf3'."
        };
      }

      // Add user's move
      this.gameState.moves.push(move);

      // Get AI response using Stockfish or fallback
      const aiMove = await this.getAIMove();

      if (aiMove) {
        this.gameState.moves.push(aiMove);
      }

      // Check for game end conditions
      this.checkGameEnd();

      return {
        success: true,
        aiMove,
        gameState: this.gameState,
        message: aiMove ? `I played ${aiMove}. Your turn!` : "Game over!"
      };
    } catch (error) {
      console.error('Chess move error:', error);
      return {
        success: false,
        gameState: this.gameState,
        message: "Something went wrong with the chess engine."
      };
    }
  }

  private async getAIMove(): Promise<string | undefined> {
    if (this.gameState.gameOver) return undefined;

    try {
      if (this.stockfish && this.isReady) {
        // Use Stockfish for move generation
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(this.getFallbackMove()), 3000);

          if (this.stockfish && this.stockfish.stdout) {
            this.stockfish.stdout.on('data', (data: Buffer) => {
              const output = data.toString();
              const moveMatch = output.match(/bestmove ([a-h][1-8][a-h][1-8])/);
              if (moveMatch) {
                clearTimeout(timeout);
                resolve(moveMatch[1]);
              }
            });
          }

          // Send position and request best move
          if (this.stockfish && this.stockfish.stdin) {
            this.stockfish.stdin.write(`position startpos moves ${this.gameState.moves.join(' ')}\n`);
            this.stockfish.stdin.write('go depth 10\n');
          } else {
            clearTimeout(timeout);
            resolve(this.getFallbackMove());
          }
        });
      } else {
        // Fallback to simple AI
        return this.getFallbackMove();
      }
    } catch (error) {
      console.error('AI move generation error:', error);
      return this.getFallbackMove();
    }
  }

  private getFallbackMove(): string {
    // Simple fallback AI with basic chess knowledge
    const moveCount = this.gameState.moves.length;

    // Opening moves
    if (moveCount === 0) return 'e2e4'; // King's pawn
    if (moveCount === 2) return 'g1f3'; // King's knight
    if (moveCount === 4) return 'f1c4'; // Bishop
    if (moveCount === 6) return 'e1g1'; // Castle (if possible)

    // Mid-game moves (simple patterns)
    const midGameMoves = ['d2d4', 'b1c3', 'd1h5', 'c1f4', 'a2a3', 'h2h3'];
    const fallbackMoves = ['e2e4', 'e2e3', 'd2d4', 'd2d3', 'g1f3', 'b1c3'];

    if (moveCount < 12) {
      return midGameMoves[moveCount % midGameMoves.length];
    }

    return fallbackMoves[moveCount % fallbackMoves.length];
  }

  private isValidMove(move: string): boolean {
    // Basic move validation (coordinate notation like e2e4)
    const movePattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
    return movePattern.test(move.toLowerCase());
  }

  private checkGameEnd(): void {
    // Simple game end detection (would need proper chess library for full implementation)
    if (this.gameState.moves.length >= 100) {
      this.gameState.gameOver = true;
      this.gameState.winner = 'draw';
    }
  }

  public newGame(): ChessGameState {
    this.gameState = {
      board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: [],
      gameOver: false
    };
    return this.gameState;
  }

  public getCurrentState(): ChessGameState {
    return this.gameState;
  }

  public getBoardDisplay(): string {
    // ASCII board representation for display
    const moves = this.gameState.moves;

    let board = `
    a  b  c  d  e  f  g  h
8  ♜  ♞  ♝  ♛  ♚  ♝  ♞  ♜  8
7  ♟  ♟  ♟  ♟  ♟  ♟  ♟  ♟  7
6  .  .  .  .  .  .  .  .  6
5  .  .  .  .  .  .  .  .  5
4  .  .  .  .  .  .  .  .  4
3  .  .  .  .  .  .  .  .  3
2  ♙  ♙  ♙  ♙  ♙  ♙  ♙  ♙  2
1  ♖  ♘  ♗  ♕  ♔  ♗  ♘  ♖  1
    a  b  c  d  e  f  g  h
    `;

    return `🏆 **Chess Game** 🏆\n\n\`\`\`\n${board}\`\`\`\n\n**Moves played:** ${moves.length}\n**Last moves:** ${moves.slice(-4).join(', ')}\n\n*Use coordinate notation like 'e2e4' to make your move!*`;
  }
}

// Global chess engine instance
export const chessEngine = new ChessEngine();
// Call initializeStockfish to set up the engine when the module is loaded.
chessEngine.initializeStockfish();