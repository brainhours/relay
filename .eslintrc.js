module.exports = {
  env: {
    node: true,
    es2022: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Esta é uma biblioteca: escrever no stdout do consumidor é efeito
    // colateral que ele não pediu e não consegue desligar. `warn`/`error`
    // seguem liberados para falhas que o chamador precisa saber.
    // (Sete console.log de debug já vazaram assim — um deles despejando
    // attendees inteiros, com telefone e nome de pessoas reais.)
    'no-console': ['error', { allow: ['warn', 'error'] }]
  }
};
