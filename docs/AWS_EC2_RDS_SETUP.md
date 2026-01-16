# Deploy na AWS (EC2 + RDS PostgreSQL) — Checklist

Este projeto roda um **processo Node/Express sempre ligado** (WhatsApp Web + Chromium, Socket.IO, schedulers). Por isso, o caminho recomendado na AWS é:

- **EC2** para hospedar o backend (processo contínuo)
- **RDS PostgreSQL** para o banco

## 1) Criar o PostgreSQL no RDS

No Console AWS:

- Vá em **RDS → Create database**
- **Engine**: PostgreSQL
- **Template**: *Production* (ou *Dev/Test* se for só teste)
- **DB instance identifier**: ex. `chatbot-postgres`
- **Credentials**: defina `master username` e `master password`
- **Instance configuration**: escolha uma classe adequada (para “médio”, comece pequeno e ajuste depois)
- **Storage**: habilite autoscaling se quiser

### Networking (muito importante)

- **VPC**: a mesma onde ficará a sua EC2 (padrão costuma servir)
- **Public access**: recomendo **No** (mais seguro)
- **VPC security group**: crie/seleciona um SG do RDS (ex.: `sg-rds-chatbot`)

### Inbound rule do SG do RDS

Em **EC2 → Security Groups → sg-rds-chatbot → Inbound rules**:

- **Type**: PostgreSQL
- **Port**: 5432
- **Source**: **Security group da EC2** (ex.: `sg-ec2-chatbot`)  
  (não use `0.0.0.0/0` em produção)

### Criar o banco (database)

Após o RDS ficar *Available*:

- Em **RDS → Databases → seu DB → Configuration**, copie o **Endpoint** e a **Port**
- Crie o database (nome) se necessário. (Você pode usar o `master` para criar via psql/cliente.)

## 2) Criar a EC2 (backend)

No Console AWS:

- Vá em **EC2 → Launch instance**
- **AMI**: Ubuntu 22.04 LTS (recomendado) ou Amazon Linux 2023
- **Instance type**: para “médio”, comece com algo tipo 2 vCPU / 2–4GB (ajuste depois)
- **Key pair**: crie/seleciona (para SSH)
- **Network settings**: crie/seleciona um SG do backend (ex.: `sg-ec2-chatbot`)

### Inbound rules do SG da EC2

Em **EC2 → Security Groups → sg-ec2-chatbot → Inbound rules**:

- **SSH (22)**: *My IP* (ou IP fixo da sua rede)
- **HTTP (80)**: `0.0.0.0/0` (se usar reverse proxy)
- **HTTPS (443)**: `0.0.0.0/0` (se usar TLS)
- **Custom TCP (3000)**: evite expor em produção.  
  Se for expor temporariamente, restrinja por IP. O ideal é 80/443 → proxy → 3000 interno.

## 3) Instalar Docker na EC2 (recomendado)

No SSH da EC2 (Ubuntu), instale Docker + Compose (o método oficial da Docker é o mais confiável).

## 4) Configurar variáveis de ambiente do app (produção)

No seu `.env` na EC2 (ou secrets no seu pipeline), ajuste:

- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET=<forte>`
- `DB_DIALECT=postgres`

Escolha **um**:

### Opção A — DATABASE_URL (recomendado)

- `DATABASE_URL=postgres://USER:SENHA@RDS_ENDPOINT:5432/NOME_DO_BANCO`
- `DB_SSL=true` (em geral recomendado em RDS)

### Opção B — Variáveis separadas

- `DB_HOST=<RDS_ENDPOINT>`
- `DB_PORT=5432`
- `DB_NAME=<NOME_DO_BANCO>`
- `DB_USER=<USER>`
- `DB_PASSWORD=<SENHA>`
- `DB_SSL=true|false`

## 5) Preparar o schema no Postgres (Sequelize)

Como o projeto usa `sequelize.sync()`, a forma simples de “criar as tabelas” é:

- Subir o app 1x apontando para o RDS (com as vars acima)
- Ele vai autenticar e executar `syncDatabase()` criando tabelas no Postgres

## 6) Migração de dados SQLite → Postgres (se você já tem dados)

Depois de criar as tabelas no Postgres, rode:

```bash
npm run migrate:sqlite-to-postgres
```

Observações:

- O script tenta respeitar dependências (FK) por uma heurística.
- Se você tiver constraints rígidas/ordem complexa, pode ser necessário ajustar a ordem ou migrar por módulos.

## 7) Persistência do WhatsApp (sessão)

O projeto grava sessão/caches em:

- `./.wwebjs_auth`
- `./.wwebjs_cache`

Em produção, garanta que esses diretórios fiquem em **disco persistente** (EBS) e **não sejam perdidos** ao atualizar container.

## 8) (Opcional) Domínio + HTTPS

Recomendado em produção:

- **Route 53** para DNS
- **Nginx** na EC2 como reverse proxy
- **Let’s Encrypt (certbot)** para TLS

---

## “O que eu faço primeiro?”

1. Criar RDS + SGs (RDS só aceita 5432 do SG da EC2).
2. Criar EC2 + SG (SSH restrito; 80/443 abertos).
3. Subir o app com `.env` apontando para o RDS e validar `/health`.
4. Se necessário, rodar a migração SQLite → Postgres.

