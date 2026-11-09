'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// 1. Busca uma Pessoa cadastrada pelo CPF
export async function buscarPessoaPorCpfAction(cpfLimpo) {
  try {
    const pessoa = await prisma.pessoa.findUnique({
      where: { cpf: cpfLimpo, ativo: true },
      select: { cpf: true, nomeCompleto: true, usuario: true }
    });
    
    if (!pessoa) return { success: false, error: 'Pessoa não encontrada no cadastro.' };
    return { success: true, pessoa };
  } catch (error) {
    return { success: false, error: 'Erro ao buscar pessoa.' };
  }
}

// 2. Salva o novo Usuário vinculado à Pessoa
export async function criarUsuarioAction(formData) {
  try {
    const cpf = formData.get('cpf')?.replace(/\D/g, '');
    const senha = formData.get('senha');
    const cargo = formData.get('cargo');
    const role = formData.get('role');

    if (!cpf || !senha || !role) {
      return { success: false, error: 'CPF, Senha e Perfil são obrigatórios.' };
    }

    const usuarioExistente = await prisma.user.findUnique({ where: { pessoaCpf: cpf } });
    if (usuarioExistente) {
      return { success: false, error: 'Esta pessoa já possui um usuário cadastrado.' };
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await prisma.user.create({
      data: {
        pessoaCpf: cpf,
        senhaHash,
        cargo,
        role,
        ativo: true
      }
    });

    return { success: true, message: 'Usuário cadastrado com sucesso!' };
  } catch (error) {
    return { success: false, error: 'Erro ao criar usuário no banco.' };
  }
}

// 3. Listagem de Usuários cadastrados
export async function listarUsuariosAction() {
  try {
    const usuarios = await prisma.user.findMany({
      include: {
        pessoa: {
          select: { nomeCompleto: true, cpf: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, usuarios };
  } catch (error) {
    return { success: false, error: 'Erro ao listar usuários.' };
  }
}