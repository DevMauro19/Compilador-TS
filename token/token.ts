// token/token.ts
// Tipos de token de ChoomScript y tabla de palabras reservadas.
// Para operadores, delimitadores y palabras reservadas el tipo es su propia
// escritura ("+", "{", "choom"...), así los mensajes de error se leen tal cual.

export const TokenTypes = {
  // Especiales
  ILLEGAL: "ILLEGAL", // carácter o cadena que el lexer no pudo reconocer
  EOF: "EOF", // fin de la entrada

  // Identificadores y literales
  IDENT: "IDENT",
  INT: "INT",
  STRING: "STRING",

  // Operadores
  ASSIGN: "=",
  PLUS: "+",
  MINUS: "-",
  BANG: "!",
  ASTERISK: "*",
  POW: "**",
  SLASH: "/",
  PERCENT: "%",
  LT: "<",
  GT: ">",
  LTE: "<=",
  GTE: ">=",
  EQ: "==",
  NOT_EQ: "!=",
  AND: "&&",
  OR: "||",

  // Delimitadores
  COMMA: ",",
  SEMICOLON: ";",
  COLON: ":",
  LPAREN: "(",
  RPAREN: ")",
  LBRACE: "{",
  RBRACE: "}",
  LBRACKET: "[",
  RBRACKET: "]",

  // Palabras reservadas (vocabulario de Night City)
  LET: "choom",
  FUNCTION: "quickhack",
  RETURN: "delta",
  TRUE: "online",
  FALSE: "offline",
  IF: "scan",
  ELSE: "backdoor",
  WHILE: "netrun",
  FOR: "ping",
} as const;

export type TokenType = (typeof TokenTypes)[keyof typeof TokenTypes];

export interface Token {
  type: TokenType;
  literal: string;
  line: number; // línea donde empieza el token, contando desde 1
  column: number; // columna donde empieza el token, contando desde 1
}

// Palabra escrita en el código → tipo de token. Lo que no esté aquí es un identificador.
const keywords: Record<string, TokenType> = {
  choom: TokenTypes.LET, // declarar variable: tu choom te guarda un valor
  quickhack: TokenTypes.FUNCTION, // función: un programa que se le sube a unos objetivos (argumentos)
  delta: TokenTypes.RETURN, // "hacer delta" = largarse: salir de la función con un valor
  online: TokenTypes.TRUE,
  offline: TokenTypes.FALSE,
  scan: TokenTypes.IF, // el escáner revisa la condición antes de actuar
  backdoor: TokenTypes.ELSE, // la entrada alterna cuando la principal está cerrada
  netrun: TokenTypes.WHILE, // la sesión sigue corriendo mientras la condición esté online
  ping: TokenTypes.FOR, // recorre la red nodo por nodo, paso a paso
};

export function lookupIdent(ident: string): TokenType {
  return Object.prototype.hasOwnProperty.call(keywords, ident)
    ? keywords[ident]
    : TokenTypes.IDENT;
}

// "línea 3, columna 7": formato común de posición para los errores de todas las etapas.
export function positionOf(token: Token): string {
  return `línea ${token.line}, columna ${token.column}`;
}
