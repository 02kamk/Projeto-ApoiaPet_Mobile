export type Species = 'Gato' | 'Cão' | 'Outro';
export type Status = 'Enviada' | 'Em análise' | 'Complementação solicitada' | 'Aprovada' | 'Não aprovada' | 'Adoção concluída' | 'Desistida' | 'Encerrada por adoção';
export type Pet = { id: string; name: string; species: Species; otherSpecies?: string; age: string; size: string; description: string; care: string; availability: 'Disponível' | 'Em processo de adoção' | 'Adotado'; archived: boolean };
export type Answers = { name: string; phone: string; city: string; neighborhood: string; housing: string; agreement: string; safety: string; routine: string; animals: string; motivation: string; commitment: boolean; consent: boolean };
export type Application = { id: string; petId: string; applicantId: string; answers: Answers; version: number; consentAt: string; status: Status; history: { message: string; at: string; author: string }[] };
export type State = { pets: Pet[]; applications: Application[] };
