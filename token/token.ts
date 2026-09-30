//token/index.ts

export const TokenTypes = {
  // Especiales
  ILLEGAL: "ILLEGAL",
  EOF: "EOF",

  // Identificadores y literales
  IDENT: "IDENT",
  INT: "INT",

  // Operadores
  ASSIGN: "=",
  PLUS: "+",
  MINUS: "-",
  BANG: "!",
  ASTERISK: "*",
  POW: "**",
  SLASH: "/",
  LT: "<",
  GT: ">",
  LTE: "<=",
  GTE: ">=",
  EQ: "==",
  NOT_EQ: "!=",

  // Delimitadores
  COMMA: ",",
  SEMICOLON: ";",
  LPAREN: "(",
  RPAREN: ")",
  LBRACE: "{",
  RBRACE: "}",
  LBRACKET: "[",
  RBRACKET: "]",

  // Palabras reservadas
  FUNCTION: "FUNCTION",
  LET: "LET",
  TRUE: "TRUE",
  FALSE: "FALSE",
  IF: "IF",
  ELSE: "ELSE",
  RETURN: "RETURN",
  WHILE: "WHILE",
  FOR: "FOR",
} as const;

export type TokenType = (typeof TokenTypes)[keyof typeof TokenTypes];

export interface Token {
  type: TokenType;
  literal: string;
}

const keywords: Record<string, TokenType> = {
  fn: TokenTypes.FUNCTION, // cambia a "function" si quieres coincidir con el AST original
  let: TokenTypes.LET,
  true: TokenTypes.TRUE,
  false: TokenTypes.FALSE,
  if: TokenTypes.IF,
  else: TokenTypes.ELSE,
  return: TokenTypes.RETURN,
  while: TokenTypes.WHILE,
  for: TokenTypes.FOR,
};

export function lookupIdent(ident: string): TokenType {
  return Object.prototype.hasOwnProperty.call(keywords, ident)
    ? keywords[ident]
    : TokenTypes.IDENT;
}