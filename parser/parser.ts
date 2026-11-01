// parser/parser.ts
// Analizador sintáctico: recibe los tokens del lexer, verifica que respeten la
// gramática de ChoomScript (ver docs/design.md) y construye el AST.
//
// Es un parser Pratt: cada tipo de token puede tener una función "prefix" (si puede
// iniciar una expresión, como un número o "-") y/o una "infix" (si va entre dos
// expresiones, como "+"). La precedencia de cada operador decide cómo se agrupan.
import { Lexer } from "../lexer/lexer.ts";
import { Token, TokenType, TokenTypes, positionOf } from "../token/token.ts";
import {
  ArrayLiteral,
  AssignExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ExpressionStatement,
  ForExpression,
  FunctionLiteral,
  HashLiteral,
  Identifier,
  IfExpression,
  IndexExpression,
  InfixExpression,
  IntegerLiteral,
  LetStatement,
  PrefixExpression,
  Program,
  ReturnStatement,
  StringLiteral,
  WhileExpression,
  type Expression,
  type Statement,
} from "../ast/ast.ts";

// Mayor número = se agrupa primero
enum Precedence {
  LOWEST = 1,
  ASSIGN, // =
  OR, // ||
  AND, // &&
  EQUALS, // == !=
  LESSGREATER, // < > <= >=
  SUM, // + -
  PRODUCT, // * / %
  PREFIX, // -X !X
  EXPONENT, // **
  CALL, // miQuickhack(X)
  INDEX, // arr[i]
}

const precedences = new Map<TokenType, Precedence>([
  [TokenTypes.ASSIGN, Precedence.ASSIGN],
  [TokenTypes.OR, Precedence.OR],
  [TokenTypes.AND, Precedence.AND],
  [TokenTypes.EQ, Precedence.EQUALS],
  [TokenTypes.NOT_EQ, Precedence.EQUALS],
  [TokenTypes.LT, Precedence.LESSGREATER],
  [TokenTypes.GT, Precedence.LESSGREATER],
  [TokenTypes.LTE, Precedence.LESSGREATER],
  [TokenTypes.GTE, Precedence.LESSGREATER],
  [TokenTypes.PLUS, Precedence.SUM],
  [TokenTypes.MINUS, Precedence.SUM],
  [TokenTypes.SLASH, Precedence.PRODUCT],
  [TokenTypes.ASTERISK, Precedence.PRODUCT],
  [TokenTypes.PERCENT, Precedence.PRODUCT],
  [TokenTypes.POW, Precedence.EXPONENT],
  [TokenTypes.LPAREN, Precedence.CALL],
  [TokenTypes.LBRACKET, Precedence.INDEX],
]);

type PrefixParseFn = () => Expression | null;
type InfixParseFn = (left: Expression) => Expression | null;

// Todas las funciones de parseo devuelven null cuando encuentran un error. El error
// ya quedó registrado en this.errors, así que quien recibe null solo debe detenerse.
// El parser se detiene en el primer error: seguir después de uno solo produce
// errores "en cascada" que confunden más de lo que ayudan.
export class Parser {
  errors: string[] = [];

  private curToken: Token = { type: TokenTypes.EOF, literal: "", line: 1, column: 1 };
  private peekToken: Token = { type: TokenTypes.EOF, literal: "", line: 1, column: 1 };

  private prefixParseFns = new Map<TokenType, PrefixParseFn>();
  private infixParseFns = new Map<TokenType, InfixParseFn>();

  constructor(private readonly lexer: Lexer) {
    // Funciones prefix (token al INICIO de una expresión)
    this.registerPrefix(TokenTypes.IDENT, this.parseIdentifier.bind(this));
    this.registerPrefix(TokenTypes.INT, this.parseIntegerLiteral.bind(this));
    this.registerPrefix(TokenTypes.STRING, this.parseStringLiteral.bind(this));
    this.registerPrefix(TokenTypes.BANG, this.parsePrefixExpression.bind(this));
    this.registerPrefix(TokenTypes.MINUS, this.parsePrefixExpression.bind(this));
    this.registerPrefix(TokenTypes.TRUE, this.parseBoolean.bind(this));
    this.registerPrefix(TokenTypes.FALSE, this.parseBoolean.bind(this));
    this.registerPrefix(TokenTypes.LPAREN, this.parseGroupedExpression.bind(this));
    this.registerPrefix(TokenTypes.LBRACKET, this.parseArrayLiteral.bind(this));
    this.registerPrefix(TokenTypes.LBRACE, this.parseHashLiteral.bind(this));
    this.registerPrefix(TokenTypes.IF, this.parseIfExpression.bind(this));
    this.registerPrefix(TokenTypes.FUNCTION, this.parseFunctionLiteral.bind(this));
    this.registerPrefix(TokenTypes.WHILE, this.parseWhileExpression.bind(this));
    this.registerPrefix(TokenTypes.FOR, this.parseForExpression.bind(this));

    // Funciones infix (token EN MEDIO de dos expresiones)
    const infixTokens = [
      TokenTypes.PLUS,
      TokenTypes.MINUS,
      TokenTypes.SLASH,
      TokenTypes.ASTERISK,
      TokenTypes.PERCENT,
      TokenTypes.EQ,
      TokenTypes.NOT_EQ,
      TokenTypes.LT,
      TokenTypes.GT,
      TokenTypes.LTE,
      TokenTypes.GTE,
      TokenTypes.POW,
      TokenTypes.AND,
      TokenTypes.OR,
    ];
    for (const t of infixTokens) {
      this.registerInfix(t, this.parseInfixExpression.bind(this));
    }
    this.registerInfix(TokenTypes.LPAREN, this.parseCallExpression.bind(this));
    this.registerInfix(TokenTypes.LBRACKET, this.parseIndexExpression.bind(this));
    this.registerInfix(TokenTypes.ASSIGN, this.parseAssignExpression.bind(this));

    // Cargamos dos tokens: curToken y peekToken
    this.nextToken();
    this.nextToken();
  }

  private nextToken(): void {
    this.curToken = this.peekToken;
    this.peekToken = this.lexer.nextToken();
  }

  // ===========================================================================
  // Punto de entrada
  // ===========================================================================

  parseProgram(): Program {
    const program = new Program();

    while (!this.curTokenIs(TokenTypes.EOF)) {
      const stmt = this.parseStatement();
      if (stmt === null) break;
      program.statements.push(stmt);
      this.nextToken();
    }
    return program;
  }

  private parseStatement(): Statement | null {
    switch (this.curToken.type) {
      case TokenTypes.LET:
        return this.parseLetStatement();
      case TokenTypes.RETURN:
        return this.parseReturnStatement();
      default:
        return this.parseExpressionStatement();
    }
  }

  // ===========================================================================
  // Sentencias
  // ===========================================================================

  // choom <identificador> = <expresión> [;]
  private parseLetStatement(): LetStatement | null {
    const token = this.curToken; // choom

    if (!this.expectPeek(TokenTypes.IDENT)) return null;
    const name = new Identifier(this.curToken, this.curToken.literal);

    if (!this.expectPeek(TokenTypes.ASSIGN)) return null;

    this.nextToken(); // inicio de la expresión
    const value = this.parseExpression(Precedence.LOWEST);
    if (value === null) return null;

    // El punto y coma es opcional: si está, lo consumimos.
    if (this.peekTokenIs(TokenTypes.SEMICOLON)) this.nextToken();

    return new LetStatement(token, name, value);
  }

  // delta <expresión> [;]
  private parseReturnStatement(): ReturnStatement | null {
    const token = this.curToken; // delta

    this.nextToken();
    const returnValue = this.parseExpression(Precedence.LOWEST);
    if (returnValue === null) return null;

    if (this.peekTokenIs(TokenTypes.SEMICOLON)) this.nextToken();

    return new ReturnStatement(token, returnValue);
  }

  private parseExpressionStatement(): ExpressionStatement | null {
    const token = this.curToken;
    const expression = this.parseExpression(Precedence.LOWEST);
    if (expression === null) return null;

    if (this.peekTokenIs(TokenTypes.SEMICOLON)) this.nextToken();

    return new ExpressionStatement(token, expression);
  }

  // Se llama con curToken en "{" y termina con curToken en "}".
  private parseBlockStatement(): BlockStatement | null {
    const block = new BlockStatement(this.curToken);

    this.nextToken(); // saltamos "{"

    while (!this.curTokenIs(TokenTypes.RBRACE)) {
      if (this.curTokenIs(TokenTypes.EOF)) {
        this.addError(block.token, "este bloque '{' nunca se cerró: falta '}'");
        return null;
      }
      const stmt = this.parseStatement();
      if (stmt === null) return null;
      block.statements.push(stmt);
      this.nextToken();
    }

    return block;
  }

  // ===========================================================================
  // Núcleo de Pratt
  // ===========================================================================

  // Parsea una expresión cuyos operadores tengan más precedencia que "precedence".
  // 1. La función prefix del token actual produce el lado izquierdo.
  // 2. Mientras el operador siguiente "amarre más fuerte" que el contexto actual,
  //    se vuelve el nuevo nodo raíz con lo anterior como hijo izquierdo.
  // Así "1 + 2 * 3" queda (1 + (2 * 3)): al ver "*" (PRODUCT > SUM) el 2 se lo lleva el "*".
  private parseExpression(precedence: Precedence): Expression | null {
    const prefix = this.prefixParseFns.get(this.curToken.type);
    if (prefix === undefined) {
      this.noPrefixParseFnError(this.curToken);
      return null;
    }

    let leftExp = prefix();

    while (
      leftExp !== null &&
      !this.peekTokenIs(TokenTypes.SEMICOLON) &&
      precedence < this.peekPrecedence()
    ) {
      const infix = this.infixParseFns.get(this.peekToken.type);
      if (infix === undefined) return leftExp;

      this.nextToken(); // avanzamos al operador
      leftExp = infix(leftExp);
    }

    return leftExp;
  }

  // ===========================================================================
  // Funciones prefix
  // ===========================================================================

  private parseIdentifier(): Expression {
    return new Identifier(this.curToken, this.curToken.literal);
  }

  private parseIntegerLiteral(): Expression | null {
    const token = this.curToken;
    const value = Number.parseInt(token.literal, 10);

    // Equivale al error de ParseInt en Go cuando el número no cabe
    if (!Number.isSafeInteger(value)) {
      this.addError(token, `el número ${token.literal} es demasiado grande`);
      return null;
    }

    return new IntegerLiteral(token, value);
  }

  private parseStringLiteral(): Expression {
    return new StringLiteral(this.curToken, this.curToken.literal);
  }

  private parseArrayLiteral(): Expression | null {
    const token = this.curToken;
    const elements = this.parseExpressionList(TokenTypes.RBRACKET);
    return elements === null ? null : new ArrayLiteral(token, elements);
  }

  // { <expr> : <expr> (, <expr> : <expr>)* }
  private parseHashLiteral(): Expression | null {
    const token = this.curToken;
    const pairs: Array<[Expression, Expression]> = [];

    while (!this.peekTokenIs(TokenTypes.RBRACE)) {
      this.nextToken();
      const key = this.parseExpression(Precedence.LOWEST);
      if (key === null) return null;

      if (!this.expectPeek(TokenTypes.COLON)) return null;

      this.nextToken();
      const value = this.parseExpression(Precedence.LOWEST);
      if (value === null) return null;

      pairs.push([key, value]);

      // Después de cada par viene "," o la "}" final.
      if (!this.peekTokenIs(TokenTypes.RBRACE) && !this.expectPeek(TokenTypes.COMMA)) {
        return null;
      }
    }

    this.nextToken(); // "}"
    return new HashLiteral(token, pairs);
  }

  private parsePrefixExpression(): Expression | null {
    const token = this.curToken;
    const operator = token.literal;

    this.nextToken();
    const right = this.parseExpression(Precedence.PREFIX);
    if (right === null) return null;

    return new PrefixExpression(token, operator, right);
  }

  private parseBoolean(): Expression {
    return new BooleanLiteral(this.curToken, this.curTokenIs(TokenTypes.TRUE));
  }

  // Los paréntesis no crean un nodo: solo reinician la precedencia a LOWEST.
  private parseGroupedExpression(): Expression | null {
    this.nextToken(); // saltamos "("

    const exp = this.parseExpression(Precedence.LOWEST);
    if (exp === null) return null;

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;
    return exp;
  }

  // ===========================================================================
  // scan, netrun, ping, quickhack
  // ===========================================================================

  // Parsea "(" condición ")" "{" y deja curToken en la "{".
  // Es el encabezado común de scan y netrun.
  private parseConditionAndOpenBrace(): Expression | null {
    if (!this.expectPeek(TokenTypes.LPAREN)) return null;

    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (condition === null) return null;

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;
    if (!this.expectPeek(TokenTypes.LBRACE)) return null;

    return condition;
  }

  // scan (cond) { ... } [backdoor { ... } | backdoor scan (...) ...]
  private parseIfExpression(): Expression | null {
    const token = this.curToken;

    const condition = this.parseConditionAndOpenBrace();
    if (condition === null) return null;

    const consequence = this.parseBlockStatement();
    if (consequence === null) return null;

    let alternative: BlockStatement | null = null;
    if (this.peekTokenIs(TokenTypes.ELSE)) {
      this.nextToken(); // avanzamos al "backdoor"
      const elseToken = this.curToken;

      if (this.peekTokenIs(TokenTypes.IF)) {
        // "backdoor scan": el scan anidado se guarda como único contenido del bloque
        // alternativo, así el evaluador no necesita un caso especial para el else-if.
        this.nextToken();
        const nested = this.parseIfExpression();
        if (nested === null) return null;
        alternative = new BlockStatement(elseToken, [new ExpressionStatement(nested.token, nested)]);
      } else {
        if (!this.expectPeek(TokenTypes.LBRACE)) return null;
        alternative = this.parseBlockStatement();
        if (alternative === null) return null;
      }
    }

    return new IfExpression(token, condition, consequence, alternative);
  }

  // netrun (cond) { ... }
  private parseWhileExpression(): Expression | null {
    const token = this.curToken;

    const condition = this.parseConditionAndOpenBrace();
    if (condition === null) return null;

    const body = this.parseBlockStatement();
    return body === null ? null : new WhileExpression(token, condition, body);
  }

  // ping (inicialización; condición; actualización) { ... }
  // La inicialización puede declarar (choom i = 0) o reutilizar una variable (i = 0).
  private parseForExpression(): Expression | null {
    const token = this.curToken;

    if (!this.expectPeek(TokenTypes.LPAREN)) return null;
    this.nextToken();

    // parseLetStatement/parseExpressionStatement consumen el ";" si está;
    // si no lo consumieron, falta y es un error.
    const init = this.curTokenIs(TokenTypes.LET)
      ? this.parseLetStatement()
      : this.parseExpressionStatement();
    if (init === null) return null;
    if (!this.curTokenIs(TokenTypes.SEMICOLON)) {
      this.peekError(TokenTypes.SEMICOLON);
      return null;
    }

    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (condition === null) return null;
    if (!this.expectPeek(TokenTypes.SEMICOLON)) return null;

    this.nextToken();
    const update = this.parseExpression(Precedence.LOWEST);
    if (update === null) return null;
    if (!this.expectPeek(TokenTypes.RPAREN)) return null;
    if (!this.expectPeek(TokenTypes.LBRACE)) return null;

    const body = this.parseBlockStatement();
    return body === null ? null : new ForExpression(token, init, condition, update, body);
  }

  // quickhack(parámetros) { cuerpo }
  private parseFunctionLiteral(): Expression | null {
    const token = this.curToken;

    if (!this.expectPeek(TokenTypes.LPAREN)) return null;

    const parameters = this.parseFunctionParameters();
    if (parameters === null) return null;

    if (!this.expectPeek(TokenTypes.LBRACE)) return null;

    const body = this.parseBlockStatement();
    return body === null ? null : new FunctionLiteral(token, parameters, body);
  }

  // Los parámetros solo pueden ser identificadores: quickhack(1, 2) es un error.
  private parseFunctionParameters(): Identifier[] | null {
    const identifiers: Identifier[] = [];

    // quickhack() sin parámetros
    if (this.peekTokenIs(TokenTypes.RPAREN)) {
      this.nextToken();
      return identifiers;
    }

    if (!this.expectPeek(TokenTypes.IDENT)) return null;
    identifiers.push(new Identifier(this.curToken, this.curToken.literal));

    while (this.peekTokenIs(TokenTypes.COMMA)) {
      this.nextToken(); // coma
      if (!this.expectPeek(TokenTypes.IDENT)) return null;
      identifiers.push(new Identifier(this.curToken, this.curToken.literal));
    }

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;

    return identifiers;
  }

  // ===========================================================================
  // Funciones infix
  // ===========================================================================

  private parseInfixExpression(left: Expression): Expression | null {
    const token = this.curToken;
    const operator = token.literal;
    const precedence = this.curPrecedence();

    this.nextToken();
    // Con la misma precedencia el lado derecho se detiene ante otro operador igual,
    // así "1 - 2 - 3" queda ((1 - 2) - 3): asociatividad a la izquierda.
    // ** es asociativo a la derecha: bajamos un nivel para que el siguiente ** se agrupe dentro.
    const rightPrec = operator === "**" ? precedence - 1 : precedence;
    const right = this.parseExpression(rightPrec);
    if (right === null) return null;

    return new InfixExpression(token, left, operator, right);
  }

  private parseCallExpression(func: Expression): Expression | null {
    const token = this.curToken; // "("
    const args = this.parseExpressionList(TokenTypes.RPAREN);
    return args === null ? null : new CallExpression(token, func, args);
  }

  // Lista de expresiones separadas por coma hasta el token "end".
  // La usan los argumentos de una llamada ")" y los arreglos "]".
  private parseExpressionList(end: TokenType): Expression[] | null {
    const list: Expression[] = [];

    if (this.peekTokenIs(end)) {
      this.nextToken();
      return list;
    }

    this.nextToken();
    const first = this.parseExpression(Precedence.LOWEST);
    if (first === null) return null;
    list.push(first);

    while (this.peekTokenIs(TokenTypes.COMMA)) {
      this.nextToken(); // coma
      this.nextToken(); // siguiente expresión
      const next = this.parseExpression(Precedence.LOWEST);
      if (next === null) return null;
      list.push(next);
    }

    if (!this.expectPeek(end)) return null;
    return list;
  }

  private parseIndexExpression(left: Expression): Expression | null {
    const token = this.curToken; // [
    this.nextToken();
    const index = this.parseExpression(Precedence.LOWEST);
    if (index === null) return null;

    if (!this.expectPeek(TokenTypes.RBRACKET)) return null;
    return new IndexExpression(token, left, index);
  }

  private parseAssignExpression(left: Expression): Expression | null {
    const token = this.curToken; // "="
    if (!(left instanceof Identifier)) {
      this.addError(token, `solo se puede asignar a una variable, no a '${left}'`);
      return null;
    }

    this.nextToken();
    // Parseamos con LOWEST para que sea asociativo a la derecha: a = b = 3
    const value = this.parseExpression(Precedence.LOWEST);
    return value === null ? null : new AssignExpression(token, left, value);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private curTokenIs(t: TokenType): boolean {
    return this.curToken.type === t;
  }

  private peekTokenIs(t: TokenType): boolean {
    return this.peekToken.type === t;
  }

  // Si el siguiente token es del tipo esperado avanza; si no, registra el error.
  private expectPeek(t: TokenType): boolean {
    if (this.peekTokenIs(t)) {
      this.nextToken();
      return true;
    }
    this.peekError(t);
    return false;
  }

  private addError(token: Token, message: string): void {
    this.errors.push(`[BREACH FALLIDO] Error sintáctico en ${positionOf(token)}: ${message}`);
  }

  private peekError(t: TokenType): void {
    this.addError(
      this.peekToken,
      `se esperaba ${describeType(t)} pero llegó ${describeToken(this.peekToken)}`
    );
  }

  private noPrefixParseFnError(token: Token): void {
    // Un ILLEGAL ya lo reportó el lexer como error léxico; no lo duplicamos.
    if (token.type === TokenTypes.ILLEGAL) return;
    this.addError(token, `se esperaba una expresión pero llegó ${describeToken(token)}`);
  }

  private registerPrefix(t: TokenType, fn: PrefixParseFn): void {
    this.prefixParseFns.set(t, fn);
  }

  private registerInfix(t: TokenType, fn: InfixParseFn): void {
    this.infixParseFns.set(t, fn);
  }

  private peekPrecedence(): Precedence {
    return precedences.get(this.peekToken.type) ?? Precedence.LOWEST;
  }

  private curPrecedence(): Precedence {
    return precedences.get(this.curToken.type) ?? Precedence.LOWEST;
  }
}

// Nombre legible de un tipo de token esperado, para los mensajes de error.
function describeType(t: TokenType): string {
  switch (t) {
    case TokenTypes.IDENT:
      return "un identificador";
    case TokenTypes.EOF:
      return "el fin del archivo";
    default:
      return `'${t}'`;
  }
}

// Descripción legible de un token concreto que llegó, para los mensajes de error.
function describeToken(token: Token): string {
  switch (token.type) {
    case TokenTypes.IDENT:
      return `el identificador '${token.literal}'`;
    case TokenTypes.INT:
      return `el número ${token.literal}`;
    case TokenTypes.STRING:
      return `la cadena "${token.literal}"`;
    case TokenTypes.EOF:
      return "el fin del archivo";
    default:
      return `'${token.literal}'`;
  }
}
