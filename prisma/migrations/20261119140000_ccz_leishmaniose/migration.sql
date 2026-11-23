-- CreateTable
CREATE TABLE "ccz_leishmaniose" (
    "id" VARCHAR(50) NOT NULL,
    "animal_id" VARCHAR(50) NOT NULL,
    "pessoa_cpf" VARCHAR(11),
    "data_fiscalizacao" DATE NOT NULL,
    "responsavel_cpf" VARCHAR(11) NOT NULL,
    "responsavel_nome" VARCHAR(150) NOT NULL,
    "responsavel_cargo" VARCHAR(150),
    "tutor_nome" VARCHAR(150),
    "tutor_cpf" VARCHAR(14),
    "tutor_endereco" VARCHAR(400),
    "tutor_telefone" VARCHAR(30),
    "tutor_bairro" VARCHAR(100),
    "animal_nome" VARCHAR(100),
    "animal_especie" VARCHAR(50),
    "animal_sexo" VARCHAR(20),
    "animal_idade" VARCHAR(50),
    "animal_raca_pelagem" VARCHAR(100),
    "animal_identificacao" VARCHAR(20),
    "apresenta_lesoes" VARCHAR(20),
    "quais_lesoes" TEXT,
    "em_tratamento" VARCHAR(20),
    "tratamento_inicio" DATE,
    "profissional_ref" VARCHAR(200),
    "medicamentos" TEXT,
    "posologia_correta" VARCHAR(20),
    "interrupcao" VARCHAR(20),
    "interrupcao_motivo" TEXT,
    "retorno_veterinario" VARCHAR(20),
    "retorno_data" DATE,
    "coleira_repelente" VARCHAR(20),
    "coleira_troca" VARCHAR(100),
    "produtos_higiene" TEXT,
    "frequencia_higiene" VARCHAR(100),
    "acesso_area_rural" VARCHAR(20),
    "deslocamento" VARCHAR(20),
    "deslocamento_quando" VARCHAR(150),
    "outros_animais" VARCHAR(20),
    "outros_animais_desc" TEXT,
    "outros_com_lesoes" VARCHAR(20),
    "pessoas_com_lesoes" VARCHAR(20),
    "pessoas_orientadas" VARCHAR(20),
    "condicoes_sanitarias" VARCHAR(20),
    "condicoes_obs" TEXT,
    "risco_disseminacao" VARCHAR(20),
    "risco_saude_publica" VARCHAR(20),
    "risco_descricao" TEXT,
    "orient_zoonose" VARCHAR(20),
    "orient_tratamento" VARCHAR(20),
    "orient_coleira" VARCHAR(20),
    "orient_novas_lesoes" VARCHAR(20),
    "orient_obrigacoes" VARCHAR(20),
    "comprometimento" VARCHAR(20),
    "conduta_tutor" VARCHAR(30),
    "situacao_geral" VARCHAR(40),
    "enc_acompanhamento" BOOLEAN NOT NULL DEFAULT false,
    "enc_notificacao" BOOLEAN NOT NULL DEFAULT false,
    "enc_outras_medidas" BOOLEAN NOT NULL DEFAULT false,
    "enc_outras_descricao" TEXT,
    "coordenador_nome" VARCHAR(150),
    "coordenador_cargo" VARCHAR(150),
    "criado_por" VARCHAR(11),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ccz_leishmaniose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_leishmaniose_equipe" (
    "id" VARCHAR(50) NOT NULL,
    "leishmaniose_id" VARCHAR(50) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "nome" VARCHAR(150) NOT NULL,
    "cargo" VARCHAR(150),
    "usuario_cpf" VARCHAR(11),
    "nao_removivel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ccz_leishmaniose_equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ccz_leishmaniose_veterinarios" (
    "id" VARCHAR(50) NOT NULL,
    "leishmaniose_id" VARCHAR(50) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "nome" VARCHAR(150) NOT NULL,
    "registro" VARCHAR(50),
    "cargo" VARCHAR(150),
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ccz_leishmaniose_veterinarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_leish_animal" ON "ccz_leishmaniose"("animal_id");

-- CreateIndex
CREATE INDEX "idx_leish_data" ON "ccz_leishmaniose"("data_fiscalizacao");

-- CreateIndex
CREATE INDEX "idx_leish_equipe" ON "ccz_leishmaniose_equipe"("leishmaniose_id");

-- CreateIndex
CREATE INDEX "idx_leish_vet" ON "ccz_leishmaniose_veterinarios"("leishmaniose_id");

-- AddForeignKey
ALTER TABLE "ccz_leishmaniose" ADD CONSTRAINT "ccz_leishmaniose_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "ccz_animais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_leishmaniose_equipe" ADD CONSTRAINT "ccz_leishmaniose_equipe_leishmaniose_id_fkey" FOREIGN KEY ("leishmaniose_id") REFERENCES "ccz_leishmaniose"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ccz_leishmaniose_veterinarios" ADD CONSTRAINT "ccz_leishmaniose_veterinarios_leishmaniose_id_fkey" FOREIGN KEY ("leishmaniose_id") REFERENCES "ccz_leishmaniose"("id") ON DELETE CASCADE ON UPDATE CASCADE;
