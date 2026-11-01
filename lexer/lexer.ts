// lexer/lexer.ts
// Analizador léxico: recorre el código carácter a carácter y lo parte en tokens.
// Además lleva la línea y la columna de cada token para los mensajes de error.
import { Token, TokenType, TokenTypes, lookupIdent, positionOf } from "../token/token.ts";

// En Go el fin de entrada se marcaba con el byte 0.
// En TS usamos la cadena vacía, que nunca coincide con un carácter real.
const EOF_CHAR = "";

export class Lexer {
  // Errores léxicos encontrados. El intérprete los revisa antes que los del parser.
  errors: string[] = [];

  private position = 0; // posición del carácter actual
  private readPosition = 0; // posición de lectura (siguiente carácter)
  private ch: string = EOF_CHAR; // carácter bajo examen
  private line = 1; // línea del carácter actual
  private column = 0; // columna del carácter actual

  constructor(private readonly input: string) {
    this.readChar();
  }

  private readChar(): void {
    // Al dejar atrás un salto de línea empieza una línea nueva.
    if (this.ch === "\n") {
      this.line += 1;
      this.column = 0;
    }
    this.ch =
      this.readPosition >= this.input.length
        ? EOF_CHAR
        : this.input[this.readPosition];
    this.position = this.readPosition;
    this.readPosition += 1;
    this.column += 1;
  }

  // Mira el siguiente carácter sin consumirlo. Sirve para decidir entre "=" y "==", "*" y "**", etc.
  private peekChar(): string {
    return this.readPosition >= this.input.length
      ? EOF_CHAR
      : this.input[this.readPosition];
  }

  // Consume el segundo carácter de un operador doble (==, !=, **, <=, >=, &&, ||) y devuelve ambos.
  private readTwoChars(): string {
    const first = this.ch;
    this.readChar();
    return first + this.ch;
  }

  // Lee una cadena entre comillas dobles o simples y procesa los escapes (\n, \t, \\, \", \').
  // Devuelve null si la línea o el archivo terminan antes de la comilla de cierre.
  private readString(): string | null {
    const quote = this.ch;
    this.readChar(); // saltamos la comilla de apertura

    let value = "";
    while (this.ch !== quote) {
      if (this.ch === EOF_CHAR || this.ch === "\n") {
        return null;
      }

      if (this.ch === "\\") {
        const escaped = this.readEscaped();
        if (escaped === EOF_CHAR) return null;

        if (escaped === "n") {
          value += "\n";
        } else if (escaped === "t") {
          value += "\t";
        } else {
          // \\, \", \' y cualquier otro carácter escapado se toman literalmente
          value += escaped;
        }
      } else {
        value += this.ch;
      }

      this.readChar();
    }

    this.readChar(); // saltamos la comilla de cierre
    return value;
  }

  // Consume la "\" de un escape y devuelve el carácter que la sigue.
  private readEscaped(): string {
    this.readChar();
    return this.ch;
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments();

    // Posición donde empieza el token; se toma antes de consumir sus caracteres.
    const line = this.line;
    const column = this.column;
    const token = (type: TokenType, literal: string): Token => ({ type, literal, line, column });

    let tok: Token;

    switch (this.ch) {
      case "=":
        tok =
          this.peekChar() === "="
            ? token(TokenTypes.EQ, this.readTwoChars())
            : token(TokenTypes.ASSIGN, this.ch);
        break;
      case "+":
        tok = token(TokenTypes.PLUS, this.ch);
        break;
      case "-":
        tok = token(TokenTypes.MINUS, this.ch);
        break;
      case "!":
        tok =
          this.peekChar() === "="
            ? token(TokenTypes.NOT_EQ, this.readTwoChars())
            : token(TokenTypes.BANG, this.ch);
        break;
      case "/":
        tok = token(TokenTypes.SLASH, this.ch);
        break;
      case "%":
        tok = token(TokenTypes.PERCENT, this.ch);
        break;
      case "*":
        tok =
          this.peekChar() === "*"
            ? token(TokenTypes.POW, this.readTwoChars())
            : token(TokenTypes.ASTERISK, this.ch);
        break;
      case "<":
        tok =
          this.peekChar() === "="
            ? token(TokenTypes.LTE, this.readTwoChars())
            : token(TokenTypes.LT, this.ch);
        break;
      case ">":
        tok =
          this.peekChar() === "="
            ? token(TokenTypes.GTE, this.readTwoChars())
            : token(TokenTypes.GT, this.ch);
        break;
      case "&":
      case "|": {
        // Solo existen dobles (&&, ||); uno suelto es un error léxico.
        const type = this.ch === "&" ? TokenTypes.AND : TokenTypes.OR;
        if (this.peekChar() === this.ch) {
          tok = token(type, this.readTwoChars());
        } else {
          tok = this.illegal(
            token(TokenTypes.ILLEGAL, this.ch),
            `carácter no reconocido '${this.ch}' (¿querías decir '${type}'?)`
          );
        }
        break;
      }
      case ";":
        tok = token(TokenTypes.SEMICOLON, this.ch);
        break;
      case ",":
        tok = token(TokenTypes.COMMA, this.ch);
        break;
      case ":":
        tok = token(TokenTypes.COLON, this.ch);
        break;
      case "{":
        tok = token(TokenTypes.LBRACE, this.ch);
        break;
      case "}":
        tok = token(TokenTypes.RBRACE, this.ch);
        break;
      case "(":
        tok = token(TokenTypes.LPAREN, this.ch);
        break;
      case ")":
        tok = token(TokenTypes.RPAREN, this.ch);
        break;
      case "[":
        tok = token(TokenTypes.LBRACKET, this.ch);
        break;
      case "]":
        tok = token(TokenTypes.RBRACKET, this.ch);
        break;
      case '"':
      case "'": {
        // readString ya deja el lexer después de la cadena, por eso se retorna sin readChar().
        const quote = this.ch;
        const value = this.readString();
        if (value === null) {
          return this.illegal(
            token(TokenTypes.ILLEGAL, quote),
            "cadena sin cerrar: falta la comilla de cierre en esta línea"
          );
        }
        return token(TokenTypes.STRING, value);
      }
      case EOF_CHAR:
        tok = token(TokenTypes.EOF, "");
        break;
      default:
        // Identificadores y números se leen completos, así que también retornan sin readChar().
        if (isLetter(this.ch)) {
          const literal = this.readIdentifier();
          return token(lookupIdent(literal), literal);
        }
        if (isDigit(this.ch)) {
          return token(TokenTypes.INT, this.readNumber());
        }
        tok = this.illegal(token(TokenTypes.ILLEGAL, this.ch), `carácter no reconocido '${this.ch}'`);
    }

    this.readChar();
    return tok;
  }

  // Registra el error léxico y devuelve el token ILLEGAL para que el parser no lo trate como válido.
  private illegal(tok: Token, reason: string): Token {
    this.errors.push(`[GLITCH] Error léxico en ${positionOf(tok)}: ${reason}`);
    return tok;
  }

  // Salta espacios, tabs, saltos de línea y comentarios de línea (// hasta el final de la línea).
  private skipWhitespaceAndComments(): void {
    while (true) {
      if (this.ch === " " || this.ch === "\t" || this.ch === "\n" || this.ch === "\r") {
        this.readChar();
      } else if (this.ch === "/" && this.peekChar() === "/") {
        this.skipComment();
      } else {
        return;
      }
    }
  }

  private skipComment(): void {
    while (this.ch !== "\n" && this.ch !== EOF_CHAR) {
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

// Cualquier letra Unicode (incluye tildes y ñ, para poder escribir "año") o guion bajo.
function isLetter(ch: string): boolean {
  return /^[\p{L}_]$/u.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}
