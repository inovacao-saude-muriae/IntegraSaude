"use client";

import { useState, useEffect, useCallback } from "react";
import Medicamentos from "@/app/camara-tecnica/farmacia-judicial/Medicamentos";
import {
  getCatalogoCompleto,
  createMedicamento,
  updateMedicamento,
  deleteMedicamento,
} from "@/app/camara-tecnica/farmacia-judicial/actions";

// Tela "Medicamentos" do Gerenciamento: reaproveita a aba de catálogo da Farmácia
// Judicial (mesmo componente e mesmas server actions).
export default function MedicamentosPage() {
  const [catalogoCompleto, setCatalogoCompleto] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const dados = await getCatalogoCompleto();
    setCatalogoCompleto(dados || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarInicial() {
      const dados = await getCatalogoCompleto();
      if (ativo) {
        setCatalogoCompleto(dados || []);
        setLoading(false);
      }
    }
    carregarInicial();
    return () => {
      ativo = false;
    };
  }, []);

  const handleCreate = async (formData) => {
    const res = await createMedicamento(formData);
    if (res.success) await carregar();
    return res;
  };

  const handleUpdate = async (id, formData) => {
    const res = await updateMedicamento(id, formData);
    if (res.success) await carregar();
    return res;
  };

  const handleDelete = async (id) => {
    const res = await deleteMedicamento(id);
    if (res.success) await carregar();
    return res;
  };

  return (
    <Medicamentos
      catalogo={catalogoCompleto}
      onCreateMedicamento={handleCreate}
      onUpdateMedicamento={handleUpdate}
      onDeleteMedicamento={handleDelete}
      loading={loading}
    />
  );
}
