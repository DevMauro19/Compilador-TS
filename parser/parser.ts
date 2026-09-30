//parser/index.ts
import { Lexer } from "../lexer/lexer.ts";
import { Token, TokenType, TokenTypes } from "../token/token.ts";
import {
  AssignExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ExpressionStatement,
  ForExpression,
  FunctionLiteral,
  Identifier,
  IfExpression,
  InfixExpression,
  IntegerLiteral,
  LetStatement,
  PrefixExpression,
  Program,
  ReturnStatement,
  WhileExpression,
  type Expression,
  type Statement,
} from "../ast/ast";

// Mayor número = se agrupa primero
enum Precedence {
  LOWEST = 1,
  ASSIGN, // =
  EQUALS, // == !=
  LESSGREATER, // < > <= >=
  SUM, // + -
  PRODUCT, // * /
  PREFIX, // -X !X
  EXPONENT, // **
  CALL, // miFuncion(X)
}

const precedences = new Map<TokenType, Precedence>([
  [TokenTypes.ASSIGN, Precedence.ASSIGN],
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
  [TokenTypes.POW, Precedence.EXPONENT],
  [TokenTypes.LPAREN, Precedence.CALL],
]);

type PrefixParseFn = () => Expression | null;
type InfixParseFn = (left: Expression) => Expression | null;

export class Parser {
  errors: string[] = [];

  private curToken: Token = { type: TokenTypes.EOF, literal: "" };
  private peekToken: Token = { type: TokenTypes.EOF, literal: "" };

  private prefixParseFns = new Map<TokenType, PrefixParseFn>();
  private infixParseFns = new Map<TokenType, InfixParseFn>();

  constructor(private readonly lexer: Lexer) {
    // Funciones prefix (token al INICIO de una expresión)
    this.registerInfix(TokenTypes.LPAREN, this.parseCallExpression.bind(this));
this.registerInfix(TokenTypes.ASSIGN, this.parseAssignExpression.bind(this));
    this.registerPrefix(TokenTypes.IDENT, this.parseIdentifier.bind(this));
    this.registerPrefix(TokenTypes.INT, this.parseIntegerLiteral.bind(this));
    this.registerPrefix(TokenTypes.BANG, this.parsePrefixExpression.bind(this));
    this.registerPrefix(TokenTypes.MINUS, this.parsePrefixExpression.bind(this));
    this.registerPrefix(TokenTypes.TRUE, this.parseBoolean.bind(this));
    this.registerPrefix(TokenTypes.FALSE, this.parseBoolean.bind(this));
    this.registerPrefix(TokenTypes.LPAREN, this.parseGroupedExpression.bind(this));
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
      TokenTypes.EQ,
      TokenTypes.NOT_EQ,
      TokenTypes.LT,
      TokenTypes.GT,
      TokenTypes.LTE,
      TokenTypes.GTE,
      TokenTypes.POW,
    ];
    for (const t of infixTokens) {
      this.registerInfix(t, this.parseInfixExpression.bind(this));
    }
    this.registerInfix(TokenTypes.LPAREN, this.parseCallExpression.bind(this));

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
      if (stmt !== null) {
        program.statements.push(stmt);
      }
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

  private parseLetStatement(): LetStatement | null {
    const token = this.curToken; // LET

    if (!this.expectPeek(TokenTypes.IDENT)) return null;
    const name = new Identifier(this.curToken, this.curToken.literal);

    if (!this.expectPeek(TokenTypes.ASSIGN)) return null;

    this.nextToken(); // inicio de la expresión
    const value = this.parseExpression(Precedence.LOWEST);

    if (this.peekTokenIs(TokenTypes.SEMICOLON)) this.nextToken();

    return new LetStatement(token, name, value);
  }

  private parseReturnStatement(): ReturnStatement {
    const token = this.curToken; // RETURN

    this.nextToken();
    const returnValue = this.parseExpression(Precedence.LOWEST);

    if (this.peekTokenIs(TokenTypes.SEMICOLON)) this.nextToken();

    return new ReturnStatement(token, returnValue);
  }

  private parseExpressionStatement(): ExpressionStatement {
    const token = this.curToken;
    const expression = this.parseExpression(Precedence.LOWEST);

    if (this.peekTokenIs(TokenTypes.SEMICOLON)) this.nextToken();

    return new ExpressionStatement(token, expression);
  }

  private parseBlockStatement(): BlockStatement {
    const block = new BlockStatement(this.curToken);

    this.nextToken(); // saltamos "{"

    while (!this.curTokenIs(TokenTypes.RBRACE) && !this.curTokenIs(TokenTypes.EOF)) {
      const stmt = this.parseStatement();
      if (stmt !== null) {
        block.statements.push(stmt);
      }
      this.nextToken();
    }

    return block;
  }

  // ===========================================================================
  // Núcleo de Pratt
  // ===========================================================================

  private parseExpression(precedence: Precedence): Expression | null {
    const prefix = this.prefixParseFns.get(this.curToken.type);
    if (prefix === undefined) {
      this.noPrefixParseFnError(this.curToken.type);
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
      this.errors.push(`No se pudo parsear "${token.literal}" como entero`);
      return null;
    }

    return new IntegerLiteral(token, value);
  }

  private parsePrefixExpression(): Expression {
    const token = this.curToken;
    const operator = token.literal;

    this.nextToken();
    const right = this.parseExpression(Precedence.PREFIX);

    return new PrefixExpression(token, operator, right);
  }

  private parseBoolean(): Expression {
    return new BooleanLiteral(this.curToken, this.curTokenIs(TokenTypes.TRUE));
  }

  private parseGroupedExpression(): Expression | null {
    this.nextToken(); // saltamos "("

    const exp = this.parseExpression(Precedence.LOWEST);

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;
    return exp;
  }

  // ===========================================================================
  // if, while, for, funciones
  // ===========================================================================

  // Parsea "(" condición ")" "{" y deja curToken en la "{".
  // Es el encabezado común de if, while y for.
  private parseConditionAndOpenBrace(): Expression | null {
    if (!this.expectPeek(TokenTypes.LPAREN)) return null;

    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (condition === null) return null;

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;
    if (!this.expectPeek(TokenTypes.LBRACE)) return null;

    return condition;
  }

  private parseIfExpression(): Expression | null {
    const token = this.curToken;

    const condition = this.parseConditionAndOpenBrace();
    if (condition === null) return null;

    const consequence = this.parseBlockStatement();

    let alternative: BlockStatement | null = null;
    if (this.peekTokenIs(TokenTypes.ELSE)) {
      this.nextToken(); // avanzamos al "else"

      if (!this.expectPeek(TokenTypes.LBRACE)) return null;

      alternative = this.parseBlockStatement();
    }

    return new IfExpression(token, condition, consequence, alternative);
  }

  private parseWhileExpression(): Expression | null {
    const token = this.curToken;

    const condition = this.parseConditionAndOpenBrace();
    if (condition === null) return null;

    return new WhileExpression(token, condition, this.parseBlockStatement());
  }

  private parseForExpression(): Expression | null {
    const token = this.curToken;

    const condition = this.parseConditionAndOpenBrace();
    if (condition === null) return null;

    return new ForExpression(token, condition, this.parseBlockStatement());
  }

  private parseFunctionLiteral(): Expression | null {
    const token = this.curToken;

    if (!this.expectPeek(TokenTypes.LPAREN)) return null;

    const parameters = this.parseFunctionParameters();
    if (parameters === null) return null;

    if (!this.expectPeek(TokenTypes.LBRACE)) return null;

    return new FunctionLiteral(token, parameters, this.parseBlockStatement());
  }

  private parseFunctionParameters(): Identifier[] | null {
    const identifiers: Identifier[] = [];

    // function() sin parámetros
    if (this.peekTokenIs(TokenTypes.RPAREN)) {
      this.nextToken();
      return identifiers;
    }

    this.nextToken(); // primer parámetro
    identifiers.push(new Identifier(this.curToken, this.curToken.literal));

    while (this.peekTokenIs(TokenTypes.COMMA)) {
      this.nextToken(); // coma
      this.nextToken(); // siguiente parámetro
      identifiers.push(new Identifier(this.curToken, this.curToken.literal));
    }

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;

    return identifiers;
  }

  // ===========================================================================
  // Funciones infix
  // ===========================================================================

private parseInfixExpression(left: Expression): Expression {
  const token = this.curToken;
  const operator = token.literal;
  const precedence = this.curPrecedence();

  this.nextToken();
  // ** es asociativo a la derecha: bajamos un nivel para que el siguiente ** se agrupe dentro
  const rightPrec = operator === "**" ? precedence - 1 : precedence;
  const right = this.parseExpression(rightPrec);

  return new InfixExpression(token, left, operator, right);
}

  private parseCallExpression(func: Expression): Expression | null {
    const token = this.curToken; // "("
    const args = this.parseCallArguments();
    if (args === null) return null;

    return new CallExpression(token, func, args);
  }

  private parseCallArguments(): Expression[] | null {
    const args: Expression[] = [];

    // add() sin argumentos
    if (this.peekTokenIs(TokenTypes.RPAREN)) {
      this.nextToken();
      return args;
    }

    this.nextToken(); // primer argumento
    const first = this.parseExpression(Precedence.LOWEST);
    if (first === null) return null;
    args.push(first);

    while (this.peekTokenIs(TokenTypes.COMMA)) {
      this.nextToken(); // coma
      this.nextToken(); // siguiente argumento
      const arg = this.parseExpression(Precedence.LOWEST);
      if (arg === null) return null;
      args.push(arg);
    }

    if (!this.expectPeek(TokenTypes.RPAREN)) return null;

    return args;
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

  private expectPeek(t: TokenType): boolean {
    if (this.peekTokenIs(t)) {
      this.nextToken();
      return true;
    }
    this.peekError(t);
    return false;
  }

  private peekError(t: TokenType): void {
    this.errors.push(
      `Error sintáctico: Se esperaba el token ${t}, se obtuvo ${this.peekToken.type}`
    );
  }

  private noPrefixParseFnError(t: TokenType): void {
    this.errors.push(`No se encontró función de parseo (prefix) para el token ${t}`);
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

  // método nuevo:
private parseAssignExpression(left: Expression): Expression | null {
  if (!(left instanceof Identifier)) {
    this.errors.push(`El lado izquierdo de "=" debe ser un identificador, se obtuvo ${left}`);
    return null;
  }
  const token = this.curToken; // "="
  this.nextToken();
  // Parseamos con LOWEST para que sea asociativo a la derecha: a = b = 3
  const value = this.parseExpression(Precedence.LOWEST);
  return new AssignExpression(token, left, value);
}
}