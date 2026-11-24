// Permissões efetivas de CCZ › Denúncias a partir de /api/me.
// Lista plana de permissões do módulo CCZ: ["denuncias:criar", ...].
// Puro (sem "use client"): pode ser usado por qualquer componente cliente.
export function podeDenuncias(dados) {
  const lista = dados?.user?.permissoes || [];
  const pode = (p) => lista.includes(`denuncias:${p}`);
  return { criar: pode("criar"), editar: pode("editar"), excluir: pode("excluir") };
}
