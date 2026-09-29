// src/token/index.ts

export type TokenType = (typeof TokenTypes)[keyof typeof TokenTypes];

export interface Token {
  type: TokenType;
  literal: string;
}

const keywords: Record<string, TokenType> = {
  fn: TokenTypes.FUNCTION,
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
  return Object.hasOwn(keywords, ident) ? keywords[ident] : TokenTypes.IDENT;
}

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
  SLASH: "/",
  LT: "<",
  GT: ">",
  EQ: "==",
  NOT_EQ: "!=",

  // Delimitadores
  COMMA: ",",
  SEMICOLON: ";",
  LPAREN: "(",
  RPAREN: ")",
  LBRACE: "{",
  RBRACE: "}",

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