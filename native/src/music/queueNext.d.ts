/** Insere a faixa imediatamente após a atual sem modificar a fila de entrada. */
export function insertNextInQueue<T extends {id: string}>(queue: T[], currentId: string | undefined | null, requested: T): T[];
