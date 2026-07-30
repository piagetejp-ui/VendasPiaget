# Escola Piaget — Sistema de Vendas V1.3.0

Versão focada em acessos internos, permissões e senha do responsável.

## O que mudou

- Adicionado Firebase Authentication no front-end para login interno por e-mail e senha.
- Criada tela **Usuários e acessos** para perfis internos.
- Perfis iniciais: Lucas/admin, Daniele/secretaria manhã, Evanda/secretaria tarde, Ruan/cantina manhã e tarde.
- A seleção provisória por cartões foi substituída por tela de login.
- Mantido modo implantação como acesso temporário de Lucas para configurar e-mails. Depois de validar o login real, desative esse modo na tela Usuários e acessos.
- Responsável continua podendo fazer primeiro acesso por matrícula + validação.
- Responsável pode criar senha dentro do portal.
- Depois que a senha existe, o reset não é automático: deve ser liberado por secretaria/gestão.
- Secretaria/gestão consegue gerar link temporário de redefinição, válido por 2 horas e uso único.
- Incluído bloqueio por tentativas inválidas de senha do responsável.

## Passos no Firebase

1. Acesse Firebase Console → Authentication.
2. Ative o método **E-mail/senha**.
3. Crie os usuários internos, por exemplo os e-mails reais de Lucas, Daniele, Evanda e Ruan.
4. Publique esta versão.
5. Entre pelo modo implantação como Lucas.
6. Abra **Usuários e acessos** e preencha o e-mail de cada perfil exatamente igual ao cadastrado no Firebase Auth.
7. Teste o login real de cada usuário.
8. Desative o modo implantação.

## Observação de segurança

Esta versão prepara a transição para regras fechadas do Firestore. Enquanto o modo implantação e as regras de desenvolvimento estiverem ativos, o sistema ainda deve ser tratado como ambiente controlado de teste.

O acesso dos responsáveis com senha foi estruturado no Firestore para a V1.3.0. Para segurança máxima em produção, a etapa futura recomendada é mover validação de senha/reset para backend/API e emitir token customizado.
