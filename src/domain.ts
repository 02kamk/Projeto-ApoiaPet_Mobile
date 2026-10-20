import { Answers, Application, Pet, State, Status } from './types';
export const terminal: Status[] = ['Não aprovada', 'Desistida', 'Adoção concluída', 'Encerrada por adoção'];
export const initial: State = { pets: [
  { id: 'luna', name: 'Luna', species: 'Gato', age: '2 anos', size: 'Pequeno', description: 'Curiosa e tranquila. Animal fictício.', care: 'Ambiente protegido e adaptação gradual.', availability: 'Disponível', archived: false },
  { id: 'thor', name: 'Thor', species: 'Cão', age: '3 anos', size: 'Grande', description: 'Companheiro e brincalhão. Animal fictício.', care: 'Passeios e atividades diárias.', availability: 'Disponível', archived: false },
  { id: 'pipoca', name: 'Pipoca', species: 'Outro', otherSpecies: 'Coelho', age: '1 ano', size: '', description: 'Coelho sociável. Animal fictício.', care: 'Espaço seguro, alimentação e cuidados próprios da espécie.', availability: 'Disponível', archived: false },
], applications: [] };
export const emptyAnswers: Answers = { name: '', phone: '', city: '', neighborhood: '', housing: '', agreement: '', safety: '', routine: '', animals: '', motivation: '', commitment: false, consent: false };
export function validate(a: Answers): string | undefined {
  if ([a.name, a.phone, a.city, a.neighborhood, a.housing, a.agreement, a.safety, a.routine, a.animals, a.motivation].some(v => !v.trim())) return 'Preencha todos os campos.';
  if (a.phone.replace(/\D/g, '').length < 10) return 'Informe telefone com DDD.';
  if (!a.commitment || !a.consent) return 'Confirme os cuidados e autorize o compartilhamento.';
}
export function submit(s: State, petId: string, answers: Answers): State {
  const pet = s.pets.find(p => p.id === petId);
  if (!pet || pet.archived || pet.availability !== 'Disponível') throw Error('Este pet não está disponível.');
  if (s.applications.some(a => a.petId === petId && a.applicantId === 'demo' && !terminal.includes(a.status))) throw Error('Você já possui candidatura ativa para este pet.');
  const error = validate(answers); if (error) throw Error(error);
  const at = new Date().toISOString();
  const application: Application = { id: `a-${Date.now()}`, petId, applicantId: 'demo', answers: { ...answers }, version: 1, consentAt: at, status: 'Enviada', history: [{ message: 'Candidatura enviada com autorização de compartilhamento.', at, author: 'Candidato' }] };
  return { ...s, applications: [...s.applications, application] };
}
const transitions: Partial<Record<Status, Status[]>> = { Enviada: ['Em análise'], 'Em análise': ['Complementação solicitada', 'Aprovada', 'Não aprovada'], 'Complementação solicitada': ['Em análise'], Aprovada: ['Adoção concluída', 'Não aprovada'] };
export function transition(s: State, id: string, next: Status, admin: boolean, message = ''): State {
  const current = s.applications.find(a => a.id === id); if (!current) throw Error('Candidatura não encontrada.');
  if (current.status === 'Adoção concluída' && next === current.status && admin) return s;
  const withdrawal = next === 'Desistida' && !terminal.includes(current.status);
  const complement = !admin && current.status === 'Complementação solicitada' && next === 'Em análise';
  if (!admin && !withdrawal && !complement) throw Error('Ação restrita ao abrigo.');
  if (!withdrawal && !transitions[current.status]?.includes(next)) throw Error('Mudança de situação inválida.');
  if ((next === 'Complementação solicitada' || complement || next === 'Não aprovada') && !message.trim()) throw Error('Escreva uma mensagem para registrar esta ação.');
  const pet = s.pets.find(p => p.id === current.petId);
  if (next === 'Adoção concluída' && (!pet || pet.archived || pet.availability === 'Adotado' || s.applications.some(a => a.petId === current.petId && a.status === 'Adoção concluída'))) throw Error('Adoção não pode ser concluída.');
  const at = new Date().toISOString();
  return { pets: s.pets.map(p => p.id === current.petId && next === 'Adoção concluída' ? { ...p, availability: 'Adotado' } : p), applications: s.applications.map(a => {
    const status = a.id === id ? next : next === 'Adoção concluída' && a.petId === current.petId && !terminal.includes(a.status) ? 'Encerrada por adoção' : undefined;
    return status ? { ...a, status, history: [...a.history, { at, author: admin ? 'Abrigo (simulação)' : 'Candidato', message: status === 'Encerrada por adoção' ? 'Pet adotado em outra candidatura. Não representa avaliação de aptidão.' : `${status}${message.trim() ? ': ' + message.trim() : ''}` }] } : a;
  }) };
}
export function petSpeciesLabel(pet: Pet): string {
  return pet.species === 'Outro' ? pet.otherSpecies?.trim() || 'Outro animal' : pet.species;
}
export function savePet(s: State, pet: Pet): State {
  if (pet.species === 'Outro' && !pet.otherSpecies?.trim()) throw Error('Informe qual é o animal ao selecionar Outro.');
  pet = { ...pet, otherSpecies: pet.species === 'Outro' ? pet.otherSpecies!.trim() : undefined };
  if (![pet.name, pet.age, pet.description, pet.care].every(v => v.trim())) throw Error('Preencha nome, idade, descrição e cuidados.');
  const old = s.pets.find(p => p.id === pet.id);
  if (old?.availability === 'Adotado' && pet.availability !== 'Adotado') throw Error('Adoção concluída deve ser preservada.');
  return { ...s, pets: old ? s.pets.map(p => p.id === pet.id ? pet : p) : [...s.pets, pet] };
}
export function removePet(s: State, id: string): State {
  if (s.applications.some(a => a.petId === id)) throw Error('Este pet tem histórico. Use arquivar.');
  return { ...s, pets: s.pets.filter(p => p.id !== id) };
}

// Preserve adopted pets in history and administration, outside adoption listings.
export function adoptionCatalog(pets: Pet[], species: Pet['species'] | 'Todos' = 'Todos', size = 'Todos'): Pet[] {
  return pets.filter(p => !p.archived && p.availability !== 'Adotado' && (species === 'Todos' || p.species === species) && (size === 'Todos' || p.size === size));
}
