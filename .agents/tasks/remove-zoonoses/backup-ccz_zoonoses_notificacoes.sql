--
-- PostgreSQL database dump
--

\restrict zqOrsiCXDd8kYhmvNlS2OkkXSxLeMxQekURNlwK1IzWOWS8GQ8MG5rYbgzQ2LJz

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ccz_zoonoses_notificacoes; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ccz_zoonoses_notificacoes (
    id character varying(50) NOT NULL,
    animal_id character varying(50) NOT NULL,
    doenca character varying(100) NOT NULL,
    data_identificacao date NOT NULL,
    grau_risco character varying(30) NOT NULL,
    risco_vida character varying(10) DEFAULT 'N├úo'::character varying,
    formas_contaminacao text,
    periodo_monitoramento character varying(50) NOT NULL,
    responsavel_monitoramento character varying(150),
    observacao text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    data_agendamento date
);


ALTER TABLE public.ccz_zoonoses_notificacoes OWNER TO admin;

--
-- Data for Name: ccz_zoonoses_notificacoes; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ccz_zoonoses_notificacoes (id, animal_id, doenca, data_identificacao, grau_risco, risco_vida, formas_contaminacao, periodo_monitoramento, responsavel_monitoramento, observacao, created_at, data_agendamento) FROM stdin;
ZOO-MVTPSQKF	161/26	zoonoses	2026-10-29	Baixo	N├úo	Sem contamina├º├úo	Sim	veterianrio	Alguma coisa de zoonoses	2026-10-29 15:45:12.84+00	2026-11-22
ZOO-MVU7PYZ0	161/26	zoonoses	2026-10-29	Baixo	Sim	lhlkjhkj	Sim	lkjhklh	\N	2026-10-30 00:06:56.845+00	2026-11-30
ZOO-MVY4WNGZ	2026/12	ajskdjasj	2026-11-01	Baixo	Sim	asdasd	N├úo	asdasd	\N	2026-11-01 17:59:14.389+00	\N
\.


--
-- Name: ccz_zoonoses_notificacoes zoonoses_notificacao_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ccz_zoonoses_notificacoes
    ADD CONSTRAINT zoonoses_notificacao_pkey PRIMARY KEY (id);


--
-- Name: ccz_zoonoses_notificacoes ccz_zoonoses_notificacoes_animal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ccz_zoonoses_notificacoes
    ADD CONSTRAINT ccz_zoonoses_notificacoes_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.ccz_animais(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict zqOrsiCXDd8kYhmvNlS2OkkXSxLeMxQekURNlwK1IzWOWS8GQ8MG5rYbgzQ2LJz

