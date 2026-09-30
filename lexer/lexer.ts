//lexer/index.ts
import { Token, TokenType, TokenTypes, lookupIdent } from "../token/token.ts";

// En Go el fin de entrada se marcaba con el byte 0.
// En TS usamos la cadena vacía, que nunca coincide con un carácter real.
const EOF_CHAR = "";

export class Lexer {
  private position = 0; // posición del carácter actual
  private readPosition = 0; // posición de lectura (siguiente carácter)
  private ch: string = EOF_CHAR; // carácter bajo examen

  constructor(private readonly input: string) {
    this.readChar();
  }

  private readChar(): void {
    this.ch =
      this.readPosition >= this.input.length
        ? EOF_CHAR
        : this.input[this.readPosition];
    this.position = this.readPosition;
    this.readPosition += 1;
  }

  private peekChar(): string {
    return this.readPosition >= this.input.length
      ? EOF_CHAR
      : this.input[this.readPosition];
  }

  // Crea un token de dos caracteres (==, !=, **, <=, >=) y consume el segundo
  private twoCharToken(type: TokenType): Token {
    const first = this.ch;
    this.readChar();
    return { type, literal: first + this.ch };
  }

  nextToken(): Token {
    let tok: Token;

    this.skipWhitespace();

    switch (this.ch) {
      case "=":
        tok =
          this.peekChar() === "="
            ? this.twoCharToken(TokenTypes.EQ)
            : newToken(TokenTypes.ASSIGN, this.ch);
        break;
      case "+":
        tok = newToken(TokenTypes.PLUS, this.ch);
        break;
      case "-":
        tok = newToken(TokenTypes.MINUS, this.ch);
        break;
      case "!":
        tok =
          this.peekChar() === "="
            ? this.twoCharToken(TokenTypes.NOT_EQ)
            : newToken(TokenTypes.BANG, this.ch);
        break;
      case "/":
        tok = newToken(TokenTypes.SLASH, this.ch);
        break;
      case "*":
        tok =
          this.peekChar() === "*"
            ? this.twoCharToken(TokenTypes.POW)
            : newToken(TokenTypes.ASTERISK, this.ch);
        break;
      case "<":
        tok =
          this.peekChar() === "="
            ? this.twoCharToken(TokenTypes.LTE)
            : newToken(TokenTypes.LT, this.ch);
        break;
      case ">":
        tok =
          this.peekChar() === "="
            ? this.twoCharToken(TokenTypes.GTE)
            : newToken(TokenTypes.GT, this.ch);
        break;
      case ";":
        tok = newToken(TokenTypes.SEMICOLON, this.ch);
        break;
      case ",":
        tok = newToken(TokenTypes.COMMA, this.ch);
        break;
      case "{":
        tok = newToken(TokenTypes.LBRACE, this.ch);
        break;
      case "}":
        tok = newToken(TokenTypes.RBRACE, this.ch);
        break;
      case "(":
        tok = newToken(TokenTypes.LPAREN, this.ch);
        break;
      case ")":
        tok = newToken(TokenTypes.RPAREN, this.ch);
        break;
      case "[":
        tok = newToken(TokenTypes.LBRACKET, this.ch);
        break;
      case "]":
        tok = newToken(TokenTypes.RBRACKET, this.ch);
        break;
      case EOF_CHAR:
        tok = { type: TokenTypes.EOF, literal: "" };
        break;
      default:
        if (isLetter(this.ch)) {
          // readIdentifier ya deja el puntero en el siguiente carácter,
          // por eso retornamos sin llamar a readChar()
          const literal = this.readIdentifier();
          return { type: lookupIdent(literal), literal };
        } else if (isDigit(this.ch)) {
          return { type: TokenTypes.INT, literal: this.readNumber() };
        }
        tok = newToken(TokenTypes.ILLEGAL, this.ch);
    }

    this.readChar();
    return tok;
  }

  private skipWhitespace(): void {
    while (
      this.ch === " " ||
      this.ch === "\t" ||
      this.ch === "\n" ||
      this.ch === "\r"
    ) {
      this.readChar();
    }
  }

  private readIdentifier(): string {
    const start = this.position;
    while (isLetter(this.ch) || isDigit(this.ch)) {
      this.readChar();
    }
    return this.input.slice(start, this.position);
  }

  private readNumber(): string {
    const start = this.position;
    while (isDigit(this.ch)) this.readChar();
    return this.input.slice(start, this.position);
  }
}

function isLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function newToken(type: TokenType, ch: string): Token {
  return { type, literal: ch };
}