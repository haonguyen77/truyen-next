// mammoth ships a browser bundle without its own type declarations.
// We use it via a dynamic import in clientParser.ts and cast to any.
declare module 'mammoth/mammoth.browser'
