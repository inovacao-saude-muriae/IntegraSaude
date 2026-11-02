-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GESTOR', 'REGULACAO_ADMIN', 'REGULACAO_COMUM', 'FARMACIA_ADMIN', 'PROCESSO_ADMIN', 'JUNTA_ADMIN', 'JUNTA_CAEE', 'JUNTA_EDUCACAO', 'JUNTA_SAUDE', 'JUNTA_ASSISTENCIA', 'CCZ_ADMIN');

-- CreateEnum
CREATE TYPE "ModuloAcesso" AS ENUM ('REGULACAO', 'FARMACIA', 'PROCESSOS', 'JUNTA', 'CCZ');

-- CreateEnum
CREATE TYPE "NivelAcesso" AS ENUM ('ADMIN', 'OPERADOR');

-- CreateEnum
CREATE TYPE "ServicoJunta" AS ENUM ('CAEE', 'APAE', 'AMBULATORIO', 'ESPECIALIDADES');

-- CreateTable
CREATE TABLE "users" (
    "cpf" VARCHAR(11) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "cargo" VARCHAR(100),
    "role" "Role" NOT NULL DEFAULT 'REGULACAO_COMUM',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acesso" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("cpf")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(11) NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoa" (
    "cpf" VARCHAR(11) NOT NULL,
    "nome_completo" VARCHAR(150) NOT NULL,
    "sexo" VARCHAR(20) NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "nome_mae" VARCHAR(150) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "cns" VARCHAR(15),
    "ubs_referencia_id" INTEGER,

    CONSTRAINT "pessoa_pkey" PRIMARY KEY ("cpf")
);

-- CreateTable
CREATE TABLE "pessoa_endereco" (
    "id" SERIAL NOT NULL,
    "pessoa_cpf" VARCHAR(11) NOT NULL,
    "logradouro" VARCHAR(150) NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "complemento" VARCHAR(50),
    "bairro" VARCHAR(100) NOT NULL,
    "cidade" VARCHAR(100) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cep" VARCHAR(8),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endereco_atual" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pessoa_endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_tipo_exame" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,

    CONSTRAINT "regula_tipo_exame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_procedimentos" (
    "id" SERIAL NOT NULL,
    "tipo_exame_id" INTEGER NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "regula_procedimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_medicos" (
    "id" SERIAL NOT NULL,
    "crm" VARCHAR(20) NOT NULL,
    "uf_crm" CHAR(2) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "especialidade" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT,

    CONSTRAINT "regula_medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_ubs" (
    "id" SERIAL NOT NULL,
    "cnes" VARCHAR(45) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regula_ubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_pedidos_exames" (
    "id" SERIAL NOT NULL,
    "pessoa_cpf" VARCHAR(11) NOT NULL,
    "cns_paciente" VARCHAR(15),
    "procedimento_id" INTEGER NOT NULL,
    "ubs_responsavel_id" INTEGER,
    "medico_solicitante_id" INTEGER,
    "medico_responsavel_id" INTEGER,
    "classificacao_risco" VARCHAR(50),
    "tipo_cota" VARCHAR(50),
    "status" VARCHAR(50) NOT NULL DEFAULT 'Aguardando',
    "status_comunicacao" VARCHAR(50) DEFAULT 'PENDENTE',
    "motivo_liberacao" TEXT,
    "observacao" TEXT,
    "data_solicitacao" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "data_comunicacao" TIMESTAMPTZ(6),
    "data_liberacao" TIMESTAMPTZ(6),
    "competencia_cota" VARCHAR(7),
    "local_realizacao" VARCHAR(20),

    CONSTRAINT "regula_pedidos_exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_cotas_financeiras" (
    "id" SERIAL NOT NULL,
    "tipo_cota" VARCHAR(50) NOT NULL,
    "mes" VARCHAR(2) NOT NULL,
    "ano" VARCHAR(4) NOT NULL,
    "valor_teto" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regula_cotas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regula_planejamento_cidade" (
    "id" SERIAL NOT NULL,
    "cidade" VARCHAR(120) NOT NULL,
    "ano" VARCHAR(4) NOT NULL,
    "mes" VARCHAR(2) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_by" VARCHAR(150),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "regula_planejamento_cidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "junta_servicos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "junta_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "junta_especialidades" (
    "id" SERIAL NOT NULL,
    "servico_id" INTEGER NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "junta_especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmacia_pacientes" (
    "numero_pasta" VARCHAR(50) NOT NULL,
    "pessoa_cpf" VARCHAR(11) NOT NULL,
    "numero_processo" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmacia_pacientes_pkey" PRIMARY KEY ("numero_pasta")
);

-- CreateTable
CREATE TABLE "farmacia_medicamentos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "dosagem" VARCHAR(50) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmacia_medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmacia_lotes_medicamentos" (
    "id" SERIAL NOT NULL,
    "medicamento_id" INTEGER NOT NULL,
    "numero_lote" VARCHAR(50) NOT NULL,
    "fornecedor" VARCHAR(150) NOT NULL,
    "qtd_inicial" INTEGER NOT NULL,
    "valor_unitario" DECIMAL(10,2) NOT NULL,
    "data_entrada" DATE NOT NULL DEFAULT CURRENT_DATE,
    "data_validade" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmacia_lotes_medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmacia_ajustes_estoque" (
    "id" SERIAL NOT NULL,
    "medicamento_id" INTEGER NOT NULL,
    "saldo_anterior" INTEGER NOT NULL,
    "saldo_novo" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "justificativa" TEXT NOT NULL,
    "responsavel" VARCHAR(150),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmacia_ajustes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmacia_tratamentos_pacientes" (
    "id" SERIAL NOT NULL,
    "paciente_pasta" VARCHAR(50) NOT NULL,
    "medicamento_id" INTEGER NOT NULL,
    "qtd_prescrita_mensal" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmacia_tratamentos_pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmacia_dispensacoes_medicamentos" (
    "id" SERIAL NOT NULL,
    "paciente_pasta" VARCHAR(50) NOT NULL,
    "lote_medicamento_id" INTEGER NOT NULL,
    "qtd_entregue" INTEGER NOT NULL,
    "data_dispensacao" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,

    CONSTRAINT "farmacia_dispensacoes_medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "junta_pacientes" (
    "id" SERIAL NOT NULL,
    "pessoa_cpf" VARCHAR(11) NOT NULL,
    "tipo_deficiencia" VARCHAR(255) NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "junta_pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "junta_paciente_servicos" (
    "paciente_junta_id" INTEGER NOT NULL,
    "servico_id" INTEGER NOT NULL,
    "data_vinculo" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN DEFAULT true,

    CONSTRAINT "junta_paciente_servicos_pkey" PRIMARY KEY ("paciente_junta_id","servico_id")
);

-- CreateTable
CREATE TABLE "junta_atendimentos" (
    "id" SERIAL NOT NULL,
    "paciente_junta_id" INTEGER NOT NULL,
    "servico_id" INTEGER NOT NULL,
    "especialidade" VARCHAR(100) NOT NULL,
    "data_atendimento" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "observacao" TEXT,
    "profissional_responsavel" VARCHAR(150),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "junta_atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "junta_agendamentos" (
    "id" SERIAL NOT NULL,
    "servico_id" INTEGER NOT NULL,
    "paciente_junta_id" INTEGER NOT NULL,
    "especialidade" VARCHAR(150) NOT NULL,
    "data" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "junta_agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_tutores" (
    "pessoa_cpf" VARCHAR(11) NOT NULL,
    "rg" VARCHAR(20),
    "sexo" VARCHAR(20),
    "profissao" VARCHAR(100),
    "telefone_secundario" VARCHAR(20),
    "ponto_referencia" VARCHAR(150),
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_zoonoses_pkey" PRIMARY KEY ("pessoa_cpf")
);

-- CreateTable
CREATE TABLE "ccz_animais" (
    "id" VARCHAR(50) NOT NULL,
    "pessoa_cpf" VARCHAR(11),
    "foto_url" TEXT,
    "nome" VARCHAR(100),
    "especie" VARCHAR(50) NOT NULL,
    "sexo" CHAR(1) NOT NULL,
    "porte" VARCHAR(20) NOT NULL,
    "idade" VARCHAR(50),
    "castrado" VARCHAR(10) DEFAULT 'Não',
    "doenca_cronica" VARCHAR(10) DEFAULT 'Não',
    "sintomas_vomito_diarreia" VARCHAR(10) DEFAULT 'Não',
    "apetite_normal" VARCHAR(10) DEFAULT 'Sim',
    "em_tratamento" VARCHAR(10) DEFAULT 'Não',
    "qual_tratamento" VARCHAR(150),
    "observacoes" TEXT,
    "possui_responsavel" VARCHAR(10) DEFAULT 'Sim',
    "endereco_recolhimento" TEXT,
    "data_cadastro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ccz_animais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_procedimentos" (
    "id" VARCHAR(50) NOT NULL,
    "animal_id" VARCHAR(50) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "data_procedimento" DATE NOT NULL,
    "veterinario" VARCHAR(150),
    "status" VARCHAR(30) NOT NULL DEFAULT 'Realizado',
    "descricao" TEXT,
    "medicacao_prescrita" TEXT,
    "data_retorno" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoonoses_procedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_termos_internacao" (
    "id" VARCHAR(50) NOT NULL,
    "procedimento_id" VARCHAR(50) NOT NULL,
    "animal_id" VARCHAR(50) NOT NULL,
    "responsavel_nome" VARCHAR(150) NOT NULL,
    "responsavel_cpf" VARCHAR(14),
    "sera_adotado" VARCHAR(10) NOT NULL DEFAULT 'Não',
    "data_termo" DATE NOT NULL,
    "cidade" VARCHAR(100) NOT NULL DEFAULT 'Muriaé',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "ccz_termos_internacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_zoonoses_notificacoes" (
    "id" VARCHAR(50) NOT NULL,
    "animal_id" VARCHAR(50) NOT NULL,
    "doenca" VARCHAR(100) NOT NULL,
    "data_identificacao" DATE NOT NULL,
    "grau_risco" VARCHAR(30) NOT NULL,
    "risco_vida" VARCHAR(10) DEFAULT 'Não',
    "formas_contaminacao" TEXT,
    "periodo_monitoramento" VARCHAR(50) NOT NULL,
    "responsavel_monitoramento" VARCHAR(150),
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoonoses_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_denuncias" (
    "id" VARCHAR(50) NOT NULL,
    "dataDenuncia" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "localizacao" TEXT NOT NULL,
    "descricao_cao" TEXT NOT NULL,
    "relato" TEXT NOT NULL,
    "animal_id" VARCHAR(50),
    "causou_risco" VARCHAR(10) DEFAULT 'Não',

    CONSTRAINT "zoonoses_denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_esporotricose" (
    "id" VARCHAR(50) NOT NULL,
    "animal_id" VARCHAR(50),
    "numero_protocolo" VARCHAR(50),
    "dataVisita" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fiscal_responsavel" VARCHAR(150),
    "apresentaLesoes" VARCHAR(10) DEFAULT 'Sim',
    "descricao_lesoes" TEXT,
    "emTratamentoContinuo" VARCHAR(10) DEFAULT 'Sim',
    "profissional_servico_ref" VARCHAR(150),
    "medicamentos_prescritos" TEXT,
    "interrupcaoTratamento" VARCHAR(10) DEFAULT 'Não',
    "retornoVeterinario" VARCHAR(10) DEFAULT 'Sim',
    "isolamentoDomiciliar" VARCHAR(10) DEFAULT 'Sim',
    "observacoes_isolamento" TEXT,
    "acessoRua" VARCHAR(10) DEFAULT 'Não',
    "usoEpi" VARCHAR(10) DEFAULT 'Sim',
    "quais_epis" VARCHAR(150),
    "higienizacao_ambiente" TEXT,
    "outrosAnimaisResidencia" VARCHAR(10) DEFAULT 'Não',
    "outros_animais_descricao" TEXT,
    "pessoasComLesoes" VARCHAR(10) DEFAULT 'Não',
    "pessoas_lesoes_descricao" TEXT,
    "conclusao_tecnica" TEXT,
    "enc_acompanhamento_ccz" BOOLEAN DEFAULT false,
    "enc_notificacao_tutor" BOOLEAN DEFAULT false,
    "enc_ministerio_publico" BOOLEAN DEFAULT false,
    "enc_outras_medidas" BOOLEAN DEFAULT false,
    "outras_medidas_descricao" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "ciente_contencao" VARCHAR(10) DEFAULT 'Não',
    "ciente_epi" VARCHAR(10) DEFAULT 'Não',
    "ciente_residuos" VARCHAR(10) DEFAULT 'Não',
    "ciente_tratamento_continuo" VARCHAR(10) DEFAULT 'Não',
    "condicoes_gerais_ambiente" TEXT,
    "descricao_tratamento_vet" TEXT,
    "em_tratamento_veterinario" VARCHAR(10) DEFAULT 'Não',

    CONSTRAINT "zoonoses_esporotricose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_esporotricose_visitas" (
    "id" VARCHAR(50) NOT NULL,
    "esporotricose_id" VARCHAR(50) NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ccz_esporotricose_visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_esporotricose_relatorios" (
    "id" VARCHAR(50) NOT NULL,
    "visita_id" VARCHAR(50) NOT NULL,
    "data_relatorio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profissional_responsavel" VARCHAR(150) NOT NULL,
    "apresenta_lesoes" VARCHAR(10) NOT NULL DEFAULT 'Não',
    "descricao_lesoes" TEXT,
    "evolucao_quadro" VARCHAR(50),
    "em_tratamento" VARCHAR(10) NOT NULL DEFAULT 'Sim',
    "medicamentos_atuais" TEXT,
    "adesao_tratamento" VARCHAR(50),
    "isolamento_adequado" VARCHAR(10) NOT NULL DEFAULT 'Sim',
    "uso_epi_adequado" VARCHAR(10) NOT NULL DEFAULT 'Sim',
    "higienizacao_adequada" VARCHAR(10) NOT NULL DEFAULT 'Sim',
    "orientacoes_repassadas" TEXT,
    "observacoes_gerais" TEXT,
    "necessidade_nova_visita" VARCHAR(10) NOT NULL DEFAULT 'Sim',
    "data_proxima_visita" DATE,
    "enc_veterinario" BOOLEAN NOT NULL DEFAULT false,
    "enc_notificacao" BOOLEAN NOT NULL DEFAULT false,
    "enc_outros" BOOLEAN NOT NULL DEFAULT false,
    "descricao_encaminhamentos" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ccz_esporotricose_relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_acessos" (
    "id" SERIAL NOT NULL,
    "user_cpf" VARCHAR(11) NOT NULL,
    "modulo" "ModuloAcesso" NOT NULL,
    "nivel" "NivelAcesso" NOT NULL,
    "servico_junta" "ServicoJunta",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_acessos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "pessoa_cns_key" ON "pessoa"("cns");

-- CreateIndex
CREATE INDEX "idx_pessoa_nome" ON "pessoa"("nome_completo", "data_nascimento");

-- CreateIndex
CREATE INDEX "pessoa_cpf_idx" ON "pessoa_endereco"("pessoa_cpf");

-- CreateIndex
CREATE INDEX "exame_id_idx" ON "regula_procedimentos"("tipo_exame_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_medico_crm" ON "regula_medicos"("crm", "uf_crm");

-- CreateIndex
CREATE UNIQUE INDEX "regula_ubs_cnes_key" ON "regula_ubs"("cnes");

-- CreateIndex
CREATE INDEX "fk_pedidos_pessoa_idx" ON "regula_pedidos_exames"("pessoa_cpf");

-- CreateIndex
CREATE INDEX "idx_pedidos_status" ON "regula_pedidos_exames"("status");

-- CreateIndex
CREATE INDEX "idx_pedido_data_solic" ON "regula_pedidos_exames"("data_solicitacao");

-- CreateIndex
CREATE INDEX "fk_pedidos_procedimento_idx" ON "regula_pedidos_exames"("procedimento_id");

-- CreateIndex
CREATE INDEX "fk_pedidos_med_solic_idx" ON "regula_pedidos_exames"("medico_solicitante_id");

-- CreateIndex
CREATE INDEX "fk_pedidos_med_resp_idx" ON "regula_pedidos_exames"("medico_responsavel_id");

-- CreateIndex
CREATE INDEX "fk_pedidos_ubs_idx" ON "regula_pedidos_exames"("ubs_responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_cota_competencia_unica" ON "regula_cotas_financeiras"("tipo_cota", "mes", "ano");

-- CreateIndex
CREATE INDEX "idx_planejamento_ano" ON "regula_planejamento_cidade"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "idx_planejamento_cidade_competencia" ON "regula_planejamento_cidade"("cidade", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "junta_servicos_nome_key" ON "junta_servicos"("nome");

-- CreateIndex
CREATE INDEX "idx_especialidade_servico" ON "junta_especialidades"("servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "farmacia_pacientes_pessoa_cpf_key" ON "farmacia_pacientes"("pessoa_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "junta_pacientes_pessoa_cpf_key" ON "junta_pacientes"("pessoa_cpf");

-- CreateIndex
CREATE INDEX "idx_agenda_servico_data" ON "junta_agendamentos"("servico_id", "data");

-- CreateIndex
CREATE INDEX "idx_procedimento_animal" ON "ccz_procedimentos"("animal_id");

-- CreateIndex
CREATE UNIQUE INDEX "ccz_termos_internacao_procedimento_id_key" ON "ccz_termos_internacao"("procedimento_id");

-- CreateIndex
CREATE INDEX "idx_termo_internacao_animal" ON "ccz_termos_internacao"("animal_id");

-- CreateIndex
CREATE INDEX "idx_esporo_visita" ON "ccz_esporotricose_visitas"("esporotricose_id");

-- CreateIndex
CREATE UNIQUE INDEX "ccz_esporotricose_relatorios_visita_id_key" ON "ccz_esporotricose_relatorios"("visita_id");

-- CreateIndex
CREATE INDEX "idx_relatorio_visita" ON "ccz_esporotricose_relatorios"("visita_id");

-- CreateIndex
CREATE INDEX "idx_user_acesso_cpf" ON "user_acessos"("user_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "idx_user_acesso_unico" ON "user_acessos"("user_cpf", "modulo", "nivel", "servico_junta");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa" ADD CONSTRAINT "fk_pessoa_ubs_referencia" FOREIGN KEY ("ubs_referencia_id") REFERENCES "regula_ubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa_endereco" ADD CONSTRAINT "fk_endereco_pessoa" FOREIGN KEY ("pessoa_cpf") REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regula_procedimentos" ADD CONSTRAINT "fk_procedimentos_tipo_exames" FOREIGN KEY ("tipo_exame_id") REFERENCES "regula_tipo_exame"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "regula_pedidos_exames" ADD CONSTRAINT "fk_pedidos_med_resp" FOREIGN KEY ("medico_responsavel_id") REFERENCES "regula_medicos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "regula_pedidos_exames" ADD CONSTRAINT "fk_pedidos_med_solic" FOREIGN KEY ("medico_solicitante_id") REFERENCES "regula_medicos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "regula_pedidos_exames" ADD CONSTRAINT "fk_pedidos_pessoa" FOREIGN KEY ("pessoa_cpf") REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regula_pedidos_exames" ADD CONSTRAINT "fk_pedidos_procedimento" FOREIGN KEY ("procedimento_id") REFERENCES "regula_procedimentos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "regula_pedidos_exames" ADD CONSTRAINT "fk_pedidos_ubs" FOREIGN KEY ("ubs_responsavel_id") REFERENCES "regula_ubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "junta_especialidades" ADD CONSTRAINT "fk_especialidade_servico" FOREIGN KEY ("servico_id") REFERENCES "junta_servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_pacientes" ADD CONSTRAINT "farmacia_pacientes_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf") REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_lotes_medicamentos" ADD CONSTRAINT "farmacia_lotes_medicamentos_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "farmacia_medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_ajustes_estoque" ADD CONSTRAINT "farmacia_ajustes_estoque_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "farmacia_medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_tratamentos_pacientes" ADD CONSTRAINT "farmacia_tratamentos_pacientes_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "farmacia_medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_tratamentos_pacientes" ADD CONSTRAINT "farmacia_tratamentos_pacientes_paciente_pasta_fkey" FOREIGN KEY ("paciente_pasta") REFERENCES "farmacia_pacientes"("numero_pasta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_dispensacoes_medicamentos" ADD CONSTRAINT "farmacia_dispensacoes_medicamentos_lote_medicamento_id_fkey" FOREIGN KEY ("lote_medicamento_id") REFERENCES "farmacia_lotes_medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmacia_dispensacoes_medicamentos" ADD CONSTRAINT "farmacia_dispensacoes_medicamentos_paciente_pasta_fkey" FOREIGN KEY ("paciente_pasta") REFERENCES "farmacia_pacientes"("numero_pasta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_pacientes" ADD CONSTRAINT "junta_pacientes_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf") REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_paciente_servicos" ADD CONSTRAINT "junta_paciente_servicos_paciente_junta_id_fkey" FOREIGN KEY ("paciente_junta_id") REFERENCES "junta_pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_paciente_servicos" ADD CONSTRAINT "junta_paciente_servicos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "junta_servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_atendimentos" ADD CONSTRAINT "junta_atendimentos_paciente_junta_id_fkey" FOREIGN KEY ("paciente_junta_id") REFERENCES "junta_pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_atendimentos" ADD CONSTRAINT "junta_atendimentos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "junta_servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_agendamentos" ADD CONSTRAINT "junta_agendamentos_paciente_junta_id_fkey" FOREIGN KEY ("paciente_junta_id") REFERENCES "junta_pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "junta_agendamentos" ADD CONSTRAINT "junta_agendamentos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "junta_servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_tutores" ADD CONSTRAINT "ccz_tutores_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf") REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_animais" ADD CONSTRAINT "ccz_animais_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf") REFERENCES "ccz_tutores"("pessoa_cpf") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_procedimentos" ADD CONSTRAINT "ccz_procedimentos_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "ccz_animais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_termos_internacao" ADD CONSTRAINT "ccz_termos_internacao_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "ccz_animais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_termos_internacao" ADD CONSTRAINT "ccz_termos_internacao_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "ccz_procedimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_zoonoses_notificacoes" ADD CONSTRAINT "ccz_zoonoses_notificacoes_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "ccz_animais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_denuncias" ADD CONSTRAINT "ccz_denuncias_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "ccz_animais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_esporotricose" ADD CONSTRAINT "ccz_esporotricose_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "ccz_animais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_esporotricose_visitas" ADD CONSTRAINT "ccz_esporotricose_visitas_esporotricose_id_fkey" FOREIGN KEY ("esporotricose_id") REFERENCES "ccz_esporotricose"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_esporotricose_relatorios" ADD CONSTRAINT "ccz_esporotricose_relatorios_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "ccz_esporotricose_visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_acessos" ADD CONSTRAINT "fk_user_acesso_user" FOREIGN KEY ("user_cpf") REFERENCES "users"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;
