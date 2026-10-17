import { Team, Player, PlayerRole } from '@/types';

function createPlayer(name: string, role: PlayerRole, teamId: string): Player {
  return {
    id: `${teamId}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    role,
    teamId,
  };
}

function createTeam(id: string, name: string, manager: string, roster: { P: string[], D: string[], C: string[], A: string[] }): Team {
  const players: Player[] = [
    ...roster.P.map(n => createPlayer(n, 'P', id)),
    ...roster.D.map(n => createPlayer(n, 'D', id)),
    ...roster.C.map(n => createPlayer(n, 'C', id)),
    ...roster.A.map(n => createPlayer(n, 'A', id)),
  ];
  return { id, name, managerName: manager, players };
}

export const teams: Team[] = [
  createTeam('ym', 'Yellow Mustard', 'Mirko M.', {
    P: ['Meret', 'Milinkovic-Savic V.', 'Svilar'],
    D: ['Bernasconi', 'Carlos Augusto', 'Comuzzo', 'Doig', 'Kabasele', 'Lucumi', 'Valle', 'Theate'],
    C: ['Ekkelenkamp', 'Fabbian', 'Nico Gonzalez', 'Gudmundsson', 'Matic', 'Paz', 'Rabiot', 'Mastantuono'],
    A: ['Castro', 'Elphege', 'Gueye', 'Lucca', 'Pinamonti', 'Stulic'],
  }),
  createTeam('am', 'Atletico Magari', 'Ilaria M.', {
    P: ['Caprile', 'Gollini', 'Vicario'],
    D: ['Ghilardi', 'Kaiki', 'Oyono', 'Pavlovic', 'Ramon', 'Tavares', 'Molina', 'Belghali'],
    C: ['Cacciamani', 'Coulibaly', 'Cristante', 'Diouf', 'Douglas Luiz', 'Lobotka', 'K. Thuram', 'Zhegrova'],
    A: ['Davis', 'Diao', 'Mendy', 'Soulé', 'Vitinha', 'Romero'],
  }),
  createTeam('fc', 'Football And City', 'Michela G.', {
    P: ['Christensen', 'De Gea', 'Okoye'],
    D: ['Coco', 'Comert', 'Dragusin', 'Hien', 'Miranda', 'Tomori', 'Troilo', 'Ziolkowski'],
    C: ['Cambiaghi', 'McKennie', 'Njie', 'Pulisic', 'Samardzic', 'Vlasic', 'Zaccagni', 'Zielinski'],
    A: ['Adorante', 'Krstovic', 'Scamacca', 'Simeone', 'Yeboah', 'Beto'],
  }),
  createTeam('sf', 'Sfortonia', 'Antonio F.', {
    P: ['Butez', 'Falcone', 'Sanchez'],
    D: ['Bisseck', 'Di Lorenzo', 'Gila', 'Jimenez', 'Olivera', 'Rensch', 'Badiashile', 'Leysen'],
    C: ['Adzic', 'Chukwueze', 'De Bruyne', 'Karlstrom', 'Perrone', 'Politano', 'Sucic', 'Schmid'],
    A: ['Ghedjemis', 'Lang', 'Noslin', 'Pellegrino', 'Alisson Santos', 'M. Thuram'],
  }),
  createTeam('rp', 'Real Pedrotte', 'Gianni C.', {
    P: ['Bijlow', 'Josep Martinez', 'Provedel'],
    D: ['Bastoni', 'Celik', 'Estupinan', 'Mina', 'Pavard', 'Provstgaard', 'Rodriguez', 'Balerdi'],
    C: ['Barella', 'Baturina', 'Conceicao', 'Isaksen', 'Locatelli', 'Mkhitaryan', 'Romano', 'El Shaarawy'],
    A: ['Che Adams', 'Berardi', 'F.P. Esposito', 'Hojlund', 'Mota', 'Enem'],
  }),
  createTeam('psg', 'Parisso San Gennaro', 'Vincenzo A.', {
    P: ['Muric', 'Pessina', 'Skorupski'],
    D: ['Akanji', 'Bellanova', 'Cambiaso', 'Obert', 'Rrahmani', 'Scalvini', 'Zappacosta', 'Zortea'],
    C: ['Ederson', 'Ellertsson', 'Ferguson', 'Frendrup', 'Modric', 'Pasalic', 'Taylor', 'Elmas'],
    A: ['Cutrone', 'De Ketelaere', 'Dovbyk', 'Giovane', 'Lautaro Martinez', 'Goncalo Ramos'],
  }),
  createTeam('le', 'Little Eagles', 'Marco A.', {
    P: ['Maignan', 'Terracciano', 'Torriani'],
    D: ['Abankwah', 'Calvani', 'Floriani Mussolini', 'Kalulu', 'Spinazzola', 'Chalobah', 'Spence', 'Lulli'],
    C: ['Atta', 'Bakola', 'Gaetano', 'Orsolini', 'Zaniolo', 'Alajbegovic', 'Mora', 'Moreira'],
    A: ['Bonny', 'Kean', 'Malen', 'Yildiz', 'Bowie', 'Kolo Muani'],
  }),
  createTeam('st', 'Salen Team', 'Valeria P.', {
    P: ['Carnesecchi', 'Sportiello', 'Pompei'],
    D: ['Bartesaghi', 'Cittadini', 'Correia', 'Delprato', 'Gallo', 'Marin', 'Wesley', 'Couto'],
    C: ['Busio', 'Calhanoglu', 'Colpani', 'De Roon', 'Frattesi', 'Keita', 'Rowe', 'Vergara'],
    A: ['Akor Adams', 'Douvikas', 'D. Maldini', 'Neres', 'Piccoli', 'Raspadori'],
  }),
  createTeam('ap', 'Amatori ProSecco', 'Daniele', {
    P: ['Corvi', 'Furlanetto', 'Mandas'],
    D: ['Bremer', 'Dimarco', 'Hainaut', 'Idzes', 'Mancini', 'Ostigard', 'Solet', 'Valeri'],
    C: ['Basic', 'Kone', 'Masini', 'McTominay', 'Perez', 'Winks', 'Fitz-Jim', 'Kessie'],
    A: ['Colombo', 'Laurienté', 'Touré', 'Varela', 'Lontani', 'Woltemade'],
  }),
  createTeam('dc', 'Dinamo Cecchignola 1927', 'Christian P.', {
    P: ['Desplanches', 'Palmisani', 'Perri'],
    D: ['Bracaglia', 'De Winter', 'Hermoso', 'Kamara', 'Mangas', 'Ndicka', 'Odenthal', 'Tiago Gabriel'],
    C: ['Adopo', 'Calò', 'Cissé', 'Da Cunha', 'Fagioli', 'Mandragora', 'Pobega', 'Rovella'],
    A: ['Dybala', 'S. Esposito', 'Kvernadze', 'Raimondo', 'Robinson', 'Osmajic'],
  }),
];


export function getTeamById(id: string): Team | undefined {
  return teams.find(t => t.id === id);
}

export function getPlayerById(playerId: string): Player | undefined {
  for (const team of teams) {
    const player = team.players.find(p => p.id === playerId);
    if (player) return player;
  }
  return undefined;
}

export function getAllPlayers(): Player[] {
  return teams.flatMap(t => t.players);
}
