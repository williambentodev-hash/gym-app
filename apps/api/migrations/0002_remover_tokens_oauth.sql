-- ADR-0014 (minimização, LGPD art. 6, III): o Google é usado só para login.
-- A partir de agora o hook em src/auth.ts descarta os tokens; esta migração limpa os já gravados.
-- Migração aditiva/compatível (expand → contract): não altera o schema, só os dados.
UPDATE account
SET accessToken = NULL,
    refreshToken = NULL,
    idToken = NULL,
    accessTokenExpiresAt = NULL,
    refreshTokenExpiresAt = NULL;
