-- FantaLive Bundlesliga - Seed Data
-- Real league data: 10 teams, 250 players, 27 rounds
-- Round 1 = Serie A Matchday 7, kickoff 2026-10-16
-- Idempotent: uses ON CONFLICT DO UPDATE

-- =============================================================================
-- TEAMS (10 fantasy teams)
-- =============================================================================
INSERT INTO teams (id, name, manager_name, manager_email) VALUES
    ('ym', 'Yellow Mustard', 'Mirko M.', NULL),
    ('am', 'Atletico Magari', 'Ilaria M.', NULL),
    ('fc', 'Football And City', 'Michela G.', NULL),
    ('sf', 'Sfortonia', 'Antonio F.', NULL),
    ('rp', 'Real Pedrotte', 'Gianni C.', NULL),
    ('psg', 'Parisso San Gennaro', 'Vincenzo A.', NULL),
    ('le', 'Little Eagles', 'Marco A.', NULL),
    ('st', 'Salen Team', 'Valeria P.', NULL),
    ('ap', 'Amatori ProSecco', 'Daniele', NULL),
    ('dc', 'Dinamo Cecchignola 1927', 'Christian P.', NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    manager_name = EXCLUDED.manager_name;

-- =============================================================================
-- PLAYERS (250 total: 25 per team)
-- Full rosters with Serie A real teams where known
-- =============================================================================

-- Yellow Mustard (Mirko M.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('ym-meret', 'Meret', 'P', 'Napoli'),
    ('ym-milinkovic-savic-v.', 'Milinkovic-Savic V.', 'P', 'Torino'),
    ('ym-svilar', 'Svilar', 'P', 'Roma'),
    ('ym-bernasconi', 'Bernasconi', 'D', NULL),
    ('ym-carlos-augusto', 'Carlos Augusto', 'D', 'Inter'),
    ('ym-comuzzo', 'Comuzzo', 'D', 'Fiorentina'),
    ('ym-doig', 'Doig', 'D', NULL),
    ('ym-kabasele', 'Kabasele', 'D', NULL),
    ('ym-lucumi', 'Lucumi', 'D', 'Bologna'),
    ('ym-valle', 'Valle', 'D', NULL),
    ('ym-theate', 'Theate', 'D', NULL),
    ('ym-ekkelenkamp', 'Ekkelenkamp', 'C', NULL),
    ('ym-fabbian', 'Fabbian', 'C', 'Bologna'),
    ('ym-nico-gonzalez', 'Nico Gonzalez', 'C', 'Juventus'),
    ('ym-gudmundsson', 'Gudmundsson', 'C', 'Fiorentina'),
    ('ym-matic', 'Matic', 'C', NULL),
    ('ym-paz', 'Paz', 'C', 'Como'),
    ('ym-rabiot', 'Rabiot', 'C', 'Milan'),
    ('ym-mastantuono', 'Mastantuono', 'C', NULL),
    ('ym-castro', 'Castro', 'A', 'Bologna'),
    ('ym-elphege', 'Elphege', 'A', NULL),
    ('ym-gueye', 'Gueye', 'A', NULL),
    ('ym-lucca', 'Lucca', 'A', 'Udinese'),
    ('ym-pinamonti', 'Pinamonti', 'A', 'Genoa'),
    ('ym-stulic', 'Stulic', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Atletico Magari (Ilaria M.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('am-caprile', 'Caprile', 'P', 'Napoli'),
    ('am-gollini', 'Gollini', 'P', NULL),
    ('am-vicario', 'Vicario', 'P', 'Fiorentina'),
    ('am-ghilardi', 'Ghilardi', 'D', NULL),
    ('am-kaiki', 'Kaiki', 'D', NULL),
    ('am-oyono', 'Oyono', 'D', NULL),
    ('am-pavlovic', 'Pavlovic', 'D', 'Milan'),
    ('am-ramon', 'Ramon', 'D', NULL),
    ('am-tavares', 'Tavares', 'D', 'Lazio'),
    ('am-molina', 'Molina', 'D', 'Juventus'),
    ('am-belghali', 'Belghali', 'D', NULL),
    ('am-cacciamani', 'Cacciamani', 'C', NULL),
    ('am-coulibaly', 'Coulibaly', 'C', NULL),
    ('am-cristante', 'Cristante', 'C', 'Roma'),
    ('am-diouf', 'Diouf', 'C', NULL),
    ('am-douglas-luiz', 'Douglas Luiz', 'C', 'Juventus'),
    ('am-lobotka', 'Lobotka', 'C', 'Napoli'),
    ('am-k.-thuram', 'K. Thuram', 'C', 'Inter'),
    ('am-zhegrova', 'Zhegrova', 'C', NULL),
    ('am-davis', 'Davis', 'A', NULL),
    ('am-diao', 'Diao', 'A', NULL),
    ('am-mendy', 'Mendy', 'A', NULL),
    ('am-soulé', 'Soulé', 'A', 'Roma'),
    ('am-vitinha', 'Vitinha', 'A', NULL),
    ('am-romero', 'Romero', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Football And City (Michela G.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('fc-christensen', 'Christensen', 'P', NULL),
    ('fc-de-gea', 'De Gea', 'P', 'Fiorentina'),
    ('fc-okoye', 'Okoye', 'P', 'Udinese'),
    ('fc-coco', 'Coco', 'D', 'Torino'),
    ('fc-comert', 'Comert', 'D', NULL),
    ('fc-dragusin', 'Dragusin', 'D', NULL),
    ('fc-hien', 'Hien', 'D', 'Atalanta'),
    ('fc-miranda', 'Miranda', 'D', NULL),
    ('fc-tomori', 'Tomori', 'D', 'Milan'),
    ('fc-troilo', 'Troilo', 'D', NULL),
    ('fc-ziolkowski', 'Ziolkowski', 'D', NULL),
    ('fc-cambiaghi', 'Cambiaghi', 'C', 'Bologna'),
    ('fc-mckennie', 'McKennie', 'C', 'Juventus'),
    ('fc-njie', 'Njie', 'C', 'Torino'),
    ('fc-pulisic', 'Pulisic', 'C', 'Milan'),
    ('fc-samardzic', 'Samardzic', 'C', 'Atalanta'),
    ('fc-vlasic', 'Vlasic', 'C', 'Torino'),
    ('fc-zaccagni', 'Zaccagni', 'C', 'Lazio'),
    ('fc-zielinski', 'Zielinski', 'C', 'Inter'),
    ('fc-adorante', 'Adorante', 'A', NULL),
    ('fc-krstovic', 'Krstovic', 'A', 'Lecce'),
    ('fc-scamacca', 'Scamacca', 'A', 'Atalanta'),
    ('fc-simeone', 'Simeone', 'A', 'Napoli'),
    ('fc-yeboah', 'Yeboah', 'A', NULL),
    ('fc-beto', 'Beto', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Sfortonia (Antonio F.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('sf-butez', 'Butez', 'P', NULL),
    ('sf-falcone', 'Falcone', 'P', 'Lecce'),
    ('sf-sanchez', 'Sanchez', 'P', NULL),
    ('sf-bisseck', 'Bisseck', 'D', 'Inter'),
    ('sf-di-lorenzo', 'Di Lorenzo', 'D', 'Napoli'),
    ('sf-gila', 'Gila', 'D', 'Lazio'),
    ('sf-jimenez', 'Jimenez', 'D', NULL),
    ('sf-olivera', 'Olivera', 'D', 'Napoli'),
    ('sf-rensch', 'Rensch', 'D', NULL),
    ('sf-badiashile', 'Badiashile', 'D', NULL),
    ('sf-leysen', 'Leysen', 'D', NULL),
    ('sf-adzic', 'Adzic', 'C', 'Juventus'),
    ('sf-chukwueze', 'Chukwueze', 'C', 'Milan'),
    ('sf-de-bruyne', 'De Bruyne', 'C', 'Napoli'),
    ('sf-karlstrom', 'Karlstrom', 'C', 'Udinese'),
    ('sf-perrone', 'Perrone', 'C', NULL),
    ('sf-politano', 'Politano', 'C', 'Napoli'),
    ('sf-sucic', 'Sucic', 'C', NULL),
    ('sf-schmid', 'Schmid', 'C', NULL),
    ('sf-ghedjemis', 'Ghedjemis', 'A', NULL),
    ('sf-lang', 'Lang', 'A', NULL),
    ('sf-noslin', 'Noslin', 'A', 'Lazio'),
    ('sf-pellegrino', 'Pellegrino', 'A', NULL),
    ('sf-alisson-santos', 'Alisson Santos', 'A', NULL),
    ('sf-m.-thuram', 'M. Thuram', 'A', 'Inter')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Real Pedrotte (Gianni C.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('rp-bijlow', 'Bijlow', 'P', NULL),
    ('rp-josep-martinez', 'Josep Martinez', 'P', 'Inter'),
    ('rp-provedel', 'Provedel', 'P', 'Lazio'),
    ('rp-bastoni', 'Bastoni', 'D', 'Inter'),
    ('rp-celik', 'Celik', 'D', 'Roma'),
    ('rp-estupinan', 'Estupinan', 'D', NULL),
    ('rp-mina', 'Mina', 'D', 'Cagliari'),
    ('rp-pavard', 'Pavard', 'D', 'Inter'),
    ('rp-provstgaard', 'Provstgaard', 'D', NULL),
    ('rp-rodriguez', 'Rodriguez', 'D', NULL),
    ('rp-balerdi', 'Balerdi', 'D', NULL),
    ('rp-barella', 'Barella', 'C', 'Inter'),
    ('rp-baturina', 'Baturina', 'C', NULL),
    ('rp-conceicao', 'Conceicao', 'C', 'Juventus'),
    ('rp-isaksen', 'Isaksen', 'C', 'Lazio'),
    ('rp-locatelli', 'Locatelli', 'C', 'Juventus'),
    ('rp-mkhitaryan', 'Mkhitaryan', 'C', 'Inter'),
    ('rp-romano', 'Romano', 'C', NULL),
    ('rp-el-shaarawy', 'El Shaarawy', 'C', 'Roma'),
    ('rp-che-adams', 'Che Adams', 'A', 'Torino'),
    ('rp-berardi', 'Berardi', 'A', NULL),
    ('rp-f.p.-esposito', 'F.P. Esposito', 'A', 'Empoli'),
    ('rp-hojlund', 'Hojlund', 'A', 'Milan'),
    ('rp-mota', 'Mota', 'A', 'Milan'),
    ('rp-enem', 'Enem', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Parisso San Gennaro (Vincenzo A.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('psg-muric', 'Muric', 'P', NULL),
    ('psg-pessina', 'Pessina', 'P', NULL),
    ('psg-skorupski', 'Skorupski', 'P', 'Bologna'),
    ('psg-akanji', 'Akanji', 'D', NULL),
    ('psg-bellanova', 'Bellanova', 'D', 'Atalanta'),
    ('psg-cambiaso', 'Cambiaso', 'D', 'Juventus'),
    ('psg-obert', 'Obert', 'D', 'Cagliari'),
    ('psg-rrahmani', 'Rrahmani', 'D', 'Napoli'),
    ('psg-scalvini', 'Scalvini', 'D', 'Atalanta'),
    ('psg-zappacosta', 'Zappacosta', 'D', 'Atalanta'),
    ('psg-zortea', 'Zortea', 'D', 'Cagliari'),
    ('psg-ederson', 'Ederson', 'C', 'Atalanta'),
    ('psg-ellertsson', 'Ellertsson', 'C', 'Genoa'),
    ('psg-ferguson', 'Ferguson', 'C', 'Bologna'),
    ('psg-frendrup', 'Frendrup', 'C', 'Genoa'),
    ('psg-modric', 'Modric', 'C', 'Milan'),
    ('psg-pasalic', 'Pasalic', 'C', 'Atalanta'),
    ('psg-taylor', 'Taylor', 'C', NULL),
    ('psg-elmas', 'Elmas', 'C', NULL),
    ('psg-cutrone', 'Cutrone', 'A', 'Como'),
    ('psg-de-ketelaere', 'De Ketelaere', 'A', 'Atalanta'),
    ('psg-dovbyk', 'Dovbyk', 'A', 'Roma'),
    ('psg-giovane', 'Giovane', 'A', NULL),
    ('psg-lautaro-martinez', 'Lautaro Martinez', 'A', 'Inter'),
    ('psg-goncalo-ramos', 'Goncalo Ramos', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Little Eagles (Marco A.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('le-maignan', 'Maignan', 'P', 'Milan'),
    ('le-terracciano', 'Terracciano', 'P', 'Fiorentina'),
    ('le-torriani', 'Torriani', 'P', 'Milan'),
    ('le-abankwah', 'Abankwah', 'D', NULL),
    ('le-calvani', 'Calvani', 'D', NULL),
    ('le-floriani-mussolini', 'Floriani Mussolini', 'D', NULL),
    ('le-kalulu', 'Kalulu', 'D', 'Juventus'),
    ('le-spinazzola', 'Spinazzola', 'D', 'Napoli'),
    ('le-chalobah', 'Chalobah', 'D', NULL),
    ('le-spence', 'Spence', 'D', NULL),
    ('le-lulli', 'Lulli', 'D', NULL),
    ('le-atta', 'Atta', 'C', NULL),
    ('le-bakola', 'Bakola', 'C', NULL),
    ('le-gaetano', 'Gaetano', 'C', 'Cagliari'),
    ('le-orsolini', 'Orsolini', 'C', 'Bologna'),
    ('le-zaniolo', 'Zaniolo', 'C', 'Atalanta'),
    ('le-alajbegovic', 'Alajbegovic', 'C', NULL),
    ('le-mora', 'Mora', 'C', NULL),
    ('le-moreira', 'Moreira', 'C', NULL),
    ('le-bonny', 'Bonny', 'A', 'Parma'),
    ('le-kean', 'Kean', 'A', 'Fiorentina'),
    ('le-malen', 'Malen', 'A', 'Atalanta'),
    ('le-yildiz', 'Yildiz', 'A', 'Juventus'),
    ('le-bowie', 'Bowie', 'A', NULL),
    ('le-kolo-muani', 'Kolo Muani', 'A', 'Juventus')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Salen Team (Valeria P.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('st-carnesecchi', 'Carnesecchi', 'P', 'Atalanta'),
    ('st-sportiello', 'Sportiello', 'P', 'Atalanta'),
    ('st-pompei', 'Pompei', 'P', NULL),
    ('st-bartesaghi', 'Bartesaghi', 'D', 'Milan'),
    ('st-cittadini', 'Cittadini', 'D', NULL),
    ('st-correia', 'Correia', 'D', NULL),
    ('st-delprato', 'Delprato', 'D', 'Parma'),
    ('st-gallo', 'Gallo', 'D', 'Lecce'),
    ('st-marin', 'Marin', 'D', NULL),
    ('st-wesley', 'Wesley', 'D', NULL),
    ('st-couto', 'Couto', 'D', 'Bologna'),
    ('st-busio', 'Busio', 'C', 'Venezia'),
    ('st-calhanoglu', 'Calhanoglu', 'C', 'Inter'),
    ('st-colpani', 'Colpani', 'C', 'Fiorentina'),
    ('st-de-roon', 'De Roon', 'C', 'Atalanta'),
    ('st-frattesi', 'Frattesi', 'C', 'Inter'),
    ('st-keita', 'Keita', 'C', NULL),
    ('st-rowe', 'Rowe', 'C', NULL),
    ('st-vergara', 'Vergara', 'C', NULL),
    ('st-akor-adams', 'Akor Adams', 'A', 'Torino'),
    ('st-douvikas', 'Douvikas', 'A', NULL),
    ('st-d.-maldini', 'D. Maldini', 'A', 'Monza'),
    ('st-neres', 'Neres', 'A', 'Napoli'),
    ('st-piccoli', 'Piccoli', 'A', 'Cagliari'),
    ('st-raspadori', 'Raspadori', 'A', 'Napoli')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Amatori ProSecco (Daniele) - USER'S TEAM
INSERT INTO players (id, name, role, real_team) VALUES
    ('ap-corvi', 'Corvi', 'P', NULL),
    ('ap-furlanetto', 'Furlanetto', 'P', NULL),
    ('ap-mandas', 'Mandas', 'P', 'Lazio'),
    ('ap-bremer', 'Bremer', 'D', 'Juventus'),
    ('ap-dimarco', 'Dimarco', 'D', 'Inter'),
    ('ap-hainaut', 'Hainaut', 'D', NULL),
    ('ap-idzes', 'Idzes', 'D', 'Venezia'),
    ('ap-mancini', 'Mancini', 'D', 'Roma'),
    ('ap-ostigard', 'Ostigard', 'D', NULL),
    ('ap-solet', 'Solet', 'D', NULL),
    ('ap-valeri', 'Valeri', 'D', NULL),
    ('ap-basic', 'Basic', 'C', 'Lazio'),
    ('ap-kone', 'Kone', 'C', 'Roma'),
    ('ap-masini', 'Masini', 'C', NULL),
    ('ap-mctominay', 'McTominay', 'C', 'Napoli'),
    ('ap-perez', 'Perez', 'C', NULL),
    ('ap-winks', 'Winks', 'C', NULL),
    ('ap-fitz-jim', 'Fitz-Jim', 'C', NULL),
    ('ap-kessie', 'Kessie', 'C', NULL),
    ('ap-colombo', 'Colombo', 'A', 'Empoli'),
    ('ap-laurienté', 'Laurienté', 'A', 'Lazio'),
    ('ap-touré', 'Touré', 'A', NULL),
    ('ap-varela', 'Varela', 'A', NULL),
    ('ap-lontani', 'Lontani', 'A', NULL),
    ('ap-woltemade', 'Woltemade', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- Dinamo Cecchignola 1927 (Christian P.)
INSERT INTO players (id, name, role, real_team) VALUES
    ('dc-desplanches', 'Desplanches', 'P', 'Palermo'),
    ('dc-palmisani', 'Palmisani', 'P', NULL),
    ('dc-perri', 'Perri', 'P', NULL),
    ('dc-bracaglia', 'Bracaglia', 'D', NULL),
    ('dc-de-winter', 'De Winter', 'D', NULL),
    ('dc-hermoso', 'Hermoso', 'D', 'Roma'),
    ('dc-kamara', 'Kamara', 'D', NULL),
    ('dc-mangas', 'Mangas', 'D', NULL),
    ('dc-ndicka', 'Ndicka', 'D', 'Roma'),
    ('dc-odenthal', 'Odenthal', 'D', NULL),
    ('dc-tiago-gabriel', 'Tiago Gabriel', 'D', NULL),
    ('dc-adopo', 'Adopo', 'C', 'Torino'),
    ('dc-calò', 'Calò', 'C', NULL),
    ('dc-cissé', 'Cissé', 'C', NULL),
    ('dc-da-cunha', 'Da Cunha', 'C', NULL),
    ('dc-fagioli', 'Fagioli', 'C', 'Juventus'),
    ('dc-mandragora', 'Mandragora', 'C', 'Fiorentina'),
    ('dc-pobega', 'Pobega', 'C', 'Bologna'),
    ('dc-rovella', 'Rovella', 'C', 'Lazio'),
    ('dc-dybala', 'Dybala', 'A', 'Roma'),
    ('dc-s.-esposito', 'S. Esposito', 'A', 'Empoli'),
    ('dc-kvernadze', 'Kvernadze', 'A', NULL),
    ('dc-raimondo', 'Raimondo', 'A', 'Bologna'),
    ('dc-robinson', 'Robinson', 'A', NULL),
    ('dc-osmajic', 'Osmajic', 'A', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, real_team = EXCLUDED.real_team;

-- =============================================================================
-- ROUNDS (27 total, Round 1 = Serie A Matchday 7, kickoff 2026-10-16)
-- Pairings cycle A..I, rounds 10-18 have swapped home/away
-- =============================================================================
INSERT INTO rounds (number, serie_a_matchday, kickoff_date, kickoff_time, pairing_cycle, is_home_swapped, lineup_deadline, status) VALUES
    (1, 7, '2026-10-16', '18:30:00', 'A', FALSE, '2026-10-16 17:30:00+02', 'scheduled'),
    (2, 8, '2026-10-23', '18:30:00', 'B', FALSE, '2026-10-23 17:30:00+02', 'scheduled'),
    (3, 9, '2026-10-27', '18:30:00', 'C', FALSE, '2026-10-27 17:30:00+02', 'scheduled'),
    (4, 10, '2026-10-31', '18:30:00', 'D', FALSE, '2026-10-31 17:30:00+01', 'scheduled'),
    (5, 11, '2026-11-06', '18:30:00', 'E', FALSE, '2026-11-06 17:30:00+01', 'scheduled'),
    (6, 12, '2026-11-21', '18:30:00', 'F', FALSE, '2026-11-21 17:30:00+01', 'scheduled'),
    (7, 13, '2026-11-27', '18:30:00', 'G', FALSE, '2026-11-27 17:30:00+01', 'scheduled'),
    (8, 14, '2026-12-04', '18:30:00', 'H', FALSE, '2026-12-04 17:30:00+01', 'scheduled'),
    (9, 15, '2026-12-11', '18:30:00', 'I', FALSE, '2026-12-11 17:30:00+01', 'scheduled'),
    (10, 16, '2026-12-18', '18:30:00', 'A', TRUE, '2026-12-18 17:30:00+01', 'scheduled'),
    (11, 17, '2027-01-01', '18:30:00', 'B', TRUE, '2027-01-01 17:30:00+01', 'scheduled'),
    (12, 18, '2027-01-05', '18:30:00', 'C', TRUE, '2027-01-05 17:30:00+01', 'scheduled'),
    (13, 19, '2027-01-08', '18:30:00', 'D', TRUE, '2027-01-08 17:30:00+01', 'scheduled'),
    (14, 20, '2027-01-15', '18:30:00', 'E', TRUE, '2027-01-15 17:30:00+01', 'scheduled'),
    (15, 21, '2027-01-22', '18:30:00', 'F', TRUE, '2027-01-22 17:30:00+01', 'scheduled'),
    (16, 22, '2027-01-29', '18:30:00', 'G', TRUE, '2027-01-29 17:30:00+01', 'scheduled'),
    (17, 23, '2027-02-05', '18:30:00', 'H', TRUE, '2027-02-05 17:30:00+01', 'scheduled'),
    (18, 24, '2027-02-12', '18:30:00', 'I', TRUE, '2027-02-12 17:30:00+01', 'scheduled'),
    (19, 25, '2027-02-19', '18:30:00', 'A', FALSE, '2027-02-19 17:30:00+01', 'scheduled'),
    (20, 26, '2027-02-26', '18:30:00', 'B', FALSE, '2027-02-26 17:30:00+01', 'scheduled'),
    (21, 27, '2027-03-05', '18:30:00', 'C', FALSE, '2027-03-05 17:30:00+01', 'scheduled'),
    (22, 28, '2027-03-12', '18:30:00', 'D', FALSE, '2027-03-12 17:30:00+01', 'scheduled'),
    (23, 29, '2027-03-19', '18:30:00', 'E', FALSE, '2027-03-19 17:30:00+01', 'scheduled'),
    (24, 30, '2027-04-02', '18:30:00', 'F', FALSE, '2027-04-02 17:30:00+02', 'scheduled'),
    (25, 31, '2027-04-09', '18:30:00', 'G', FALSE, '2027-04-09 17:30:00+02', 'scheduled'),
    (26, 32, '2027-04-16', '18:30:00', 'H', FALSE, '2027-04-16 17:30:00+02', 'scheduled'),
    (27, 33, '2027-04-23', '18:30:00', 'I', FALSE, '2027-04-23 17:30:00+02', 'scheduled')
ON CONFLICT (number) DO UPDATE SET
    serie_a_matchday = EXCLUDED.serie_a_matchday,
    kickoff_date = EXCLUDED.kickoff_date,
    kickoff_time = EXCLUDED.kickoff_time,
    pairing_cycle = EXCLUDED.pairing_cycle,
    is_home_swapped = EXCLUDED.is_home_swapped,
    lineup_deadline = EXCLUDED.lineup_deadline;

-- =============================================================================
-- MATCH PAIRINGS (27 rounds × 5 matches = 135 pairings)
-- Pairing cycles from calendario.md
-- =============================================================================

-- Helper: Delete existing pairings to allow clean re-insert
DELETE FROM match_pairings;

-- Cycle A pairings (used in rounds 1, 10, 19)
-- Little Eagles-Salen Team; Dinamo Cecchignola-Amatori ProSecco; Atletico Magari-Yellow Mustard; Real Pedrotte-Sfortonia; Football And City-Parisso San Gennaro

-- Round 1 (Cycle A, no swap)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (1, 'le', 'st'), (1, 'dc', 'ap'), (1, 'am', 'ym'), (1, 'rp', 'sf'), (1, 'fc', 'psg');

-- Round 2 (Cycle B, no swap)
-- Yellow Mustard-Little Eagles; Salen Team-Dinamo Cecchignola; Amatori ProSecco-Real Pedrotte; Parisso SG-Atletico Magari; Sfortonia-Football And City
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (2, 'ym', 'le'), (2, 'st', 'dc'), (2, 'ap', 'rp'), (2, 'psg', 'am'), (2, 'sf', 'fc');

-- Round 3 (Cycle C, no swap)
-- Little Eagles-Dinamo Cecchignola; Real Pedrotte-Salen Team; Yellow Mustard-Parisso SG; Football And City-Amatori ProSecco; Atletico Magari-Sfortonia
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (3, 'le', 'dc'), (3, 'rp', 'st'), (3, 'ym', 'psg'), (3, 'fc', 'ap'), (3, 'am', 'sf');

-- Round 4 (Cycle D, no swap)
-- Dinamo Cecchignola-Real Pedrotte; Parisso SG-Little Eagles; Salen Team-Football And City; Sfortonia-Yellow Mustard; Amatori ProSecco-Atletico Magari
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (4, 'dc', 'rp'), (4, 'psg', 'le'), (4, 'st', 'fc'), (4, 'sf', 'ym'), (4, 'ap', 'am');

-- Round 5 (Cycle E, no swap)
-- Little Eagles-Real Pedrotte; Football And City-Dinamo Cecchignola; Parisso SG-Sfortonia; Atletico Magari-Salen Team; Yellow Mustard-Amatori ProSecco
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (5, 'le', 'rp'), (5, 'fc', 'dc'), (5, 'psg', 'sf'), (5, 'am', 'st'), (5, 'ym', 'ap');

-- Round 6 (Cycle F, no swap)
-- Real Pedrotte-Football And City; Sfortonia-Little Eagles; Dinamo Cecchignola-Atletico Magari; Amatori ProSecco-Parisso SG; Salen Team-Yellow Mustard
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (6, 'rp', 'fc'), (6, 'sf', 'le'), (6, 'dc', 'am'), (6, 'ap', 'psg'), (6, 'st', 'ym');

-- Round 7 (Cycle G, no swap)
-- Little Eagles-Football And City; Atletico Magari-Real Pedrotte; Sfortonia-Amatori ProSecco; Yellow Mustard-Dinamo Cecchignola; Parisso SG-Salen Team
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (7, 'le', 'fc'), (7, 'am', 'rp'), (7, 'sf', 'ap'), (7, 'ym', 'dc'), (7, 'psg', 'st');

-- Round 8 (Cycle H, no swap)
-- Football And City-Atletico Magari; Amatori ProSecco-Little Eagles; Real Pedrotte-Yellow Mustard; Salen Team-Sfortonia; Dinamo Cecchignola-Parisso SG
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (8, 'fc', 'am'), (8, 'ap', 'le'), (8, 'rp', 'ym'), (8, 'st', 'sf'), (8, 'dc', 'psg');

-- Round 9 (Cycle I, no swap)
-- Little Eagles-Atletico Magari; Yellow Mustard-Football And City; Amatori ProSecco-Salen Team; Parisso SG-Real Pedrotte; Sfortonia-Dinamo Cecchignola
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (9, 'le', 'am'), (9, 'ym', 'fc'), (9, 'ap', 'st'), (9, 'psg', 'rp'), (9, 'sf', 'dc');

-- Round 10 (Cycle A, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (10, 'st', 'le'), (10, 'ap', 'dc'), (10, 'ym', 'am'), (10, 'sf', 'rp'), (10, 'psg', 'fc');

-- Round 11 (Cycle B, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (11, 'le', 'ym'), (11, 'dc', 'st'), (11, 'rp', 'ap'), (11, 'am', 'psg'), (11, 'fc', 'sf');

-- Round 12 (Cycle C, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (12, 'dc', 'le'), (12, 'st', 'rp'), (12, 'psg', 'ym'), (12, 'ap', 'fc'), (12, 'sf', 'am');

-- Round 13 (Cycle D, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (13, 'rp', 'dc'), (13, 'le', 'psg'), (13, 'fc', 'st'), (13, 'ym', 'sf'), (13, 'am', 'ap');

-- Round 14 (Cycle E, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (14, 'rp', 'le'), (14, 'dc', 'fc'), (14, 'sf', 'psg'), (14, 'st', 'am'), (14, 'ap', 'ym');

-- Round 15 (Cycle F, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (15, 'fc', 'rp'), (15, 'le', 'sf'), (15, 'am', 'dc'), (15, 'psg', 'ap'), (15, 'ym', 'st');

-- Round 16 (Cycle G, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (16, 'fc', 'le'), (16, 'rp', 'am'), (16, 'ap', 'sf'), (16, 'dc', 'ym'), (16, 'st', 'psg');

-- Round 17 (Cycle H, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (17, 'am', 'fc'), (17, 'le', 'ap'), (17, 'ym', 'rp'), (17, 'sf', 'st'), (17, 'psg', 'dc');

-- Round 18 (Cycle I, HOME SWAPPED)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (18, 'am', 'le'), (18, 'fc', 'ym'), (18, 'st', 'ap'), (18, 'rp', 'psg'), (18, 'dc', 'sf');

-- Round 19 (Cycle A, no swap - same as Round 1)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (19, 'le', 'st'), (19, 'dc', 'ap'), (19, 'am', 'ym'), (19, 'rp', 'sf'), (19, 'fc', 'psg');

-- Round 20 (Cycle B, no swap - same as Round 2)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (20, 'ym', 'le'), (20, 'st', 'dc'), (20, 'ap', 'rp'), (20, 'psg', 'am'), (20, 'sf', 'fc');

-- Round 21 (Cycle C, no swap - same as Round 3)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (21, 'le', 'dc'), (21, 'rp', 'st'), (21, 'ym', 'psg'), (21, 'fc', 'ap'), (21, 'am', 'sf');

-- Round 22 (Cycle D, no swap - same as Round 4)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (22, 'dc', 'rp'), (22, 'psg', 'le'), (22, 'st', 'fc'), (22, 'sf', 'ym'), (22, 'ap', 'am');

-- Round 23 (Cycle E, no swap - same as Round 5)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (23, 'le', 'rp'), (23, 'fc', 'dc'), (23, 'psg', 'sf'), (23, 'am', 'st'), (23, 'ym', 'ap');

-- Round 24 (Cycle F, no swap - same as Round 6)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (24, 'rp', 'fc'), (24, 'sf', 'le'), (24, 'dc', 'am'), (24, 'ap', 'psg'), (24, 'st', 'ym');

-- Round 25 (Cycle G, no swap - same as Round 7)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (25, 'le', 'fc'), (25, 'am', 'rp'), (25, 'sf', 'ap'), (25, 'ym', 'dc'), (25, 'psg', 'st');

-- Round 26 (Cycle H, no swap - same as Round 8)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (26, 'fc', 'am'), (26, 'ap', 'le'), (26, 'rp', 'ym'), (26, 'st', 'sf'), (26, 'dc', 'psg');

-- Round 27 (Cycle I, no swap - same as Round 9)
INSERT INTO match_pairings (round_number, home_team_id, away_team_id) VALUES
    (27, 'le', 'am'), (27, 'ym', 'fc'), (27, 'ap', 'st'), (27, 'psg', 'rp'), (27, 'sf', 'dc');

-- =============================================================================
-- INITIAL ROSTER VERSIONS (all teams start with 60 market credits)
-- =============================================================================
DELETE FROM roster_players WHERE roster_version_id IN (
    SELECT id FROM roster_versions WHERE version_number = 1
);
DELETE FROM roster_versions WHERE version_number = 1;

INSERT INTO roster_versions (id, team_id, version_number, effective_from, credits_remaining, market_credits, notes) VALUES
    ('11111111-1111-1111-1111-111111111111', 'ym', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('22222222-2222-2222-2222-222222222222', 'am', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('33333333-3333-3333-3333-333333333333', 'fc', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('44444444-4444-4444-4444-444444444444', 'sf', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('55555555-5555-5555-5555-555555555555', 'rp', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('66666666-6666-6666-6666-666666666666', 'psg', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('77777777-7777-7777-7777-777777777777', 'le', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('88888888-8888-8888-8888-888888888888', 'st', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('99999999-9999-9999-9999-999999999999', 'ap', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dc', 1, '2026-10-01 00:00:00+02', 0, 60, 'Initial roster from auction')
ON CONFLICT (team_id, version_number) DO NOTHING;

-- =============================================================================
-- ROSTER PLAYERS (link players to their initial roster versions)
-- =============================================================================

-- Yellow Mustard roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '11111111-1111-1111-1111-111111111111', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'ym-%'
ON CONFLICT DO NOTHING;

-- Atletico Magari roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '22222222-2222-2222-2222-222222222222', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'am-%'
ON CONFLICT DO NOTHING;

-- Football And City roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '33333333-3333-3333-3333-333333333333', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'fc-%'
ON CONFLICT DO NOTHING;

-- Sfortonia roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '44444444-4444-4444-4444-444444444444', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'sf-%'
ON CONFLICT DO NOTHING;

-- Real Pedrotte roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '55555555-5555-5555-5555-555555555555', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'rp-%'
ON CONFLICT DO NOTHING;

-- Parisso San Gennaro roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '66666666-6666-6666-6666-666666666666', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'psg-%'
ON CONFLICT DO NOTHING;

-- Little Eagles roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '77777777-7777-7777-7777-777777777777', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'le-%'
ON CONFLICT DO NOTHING;

-- Salen Team roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '88888888-8888-8888-8888-888888888888', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'st-%'
ON CONFLICT DO NOTHING;

-- Amatori ProSecco roster (user's team)
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT '99999999-9999-9999-9999-999999999999', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'ap-%'
ON CONFLICT DO NOTHING;

-- Dinamo Cecchignola roster
INSERT INTO roster_players (roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 'auction', 0, '2026-10-01 00:00:00+02'
FROM players WHERE id LIKE 'dc-%'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- MARKET WINDOWS (weekly, Mon 00:00 - Thu 18:59)
-- Skip January (is_january_block = TRUE)
-- =============================================================================
DELETE FROM market_windows;

INSERT INTO market_windows (week_number, opens_at, closes_at, effective_round, is_january_block) VALUES
    (1, '2026-10-19 00:00:00+02', '2026-10-22 18:59:00+02', 2, FALSE),
    (2, '2026-10-26 00:00:00+02', '2026-10-29 18:59:00+02', 3, FALSE),
    (3, '2026-11-02 00:00:00+01', '2026-11-05 18:59:00+01', 4, FALSE),
    (4, '2026-11-09 00:00:00+01', '2026-11-12 18:59:00+01', 5, FALSE),
    (5, '2026-11-23 00:00:00+01', '2026-11-26 18:59:00+01', 6, FALSE),
    (6, '2026-11-30 00:00:00+01', '2026-12-03 18:59:00+01', 7, FALSE),
    (7, '2026-12-07 00:00:00+01', '2026-12-10 18:59:00+01', 8, FALSE),
    (8, '2026-12-14 00:00:00+01', '2026-12-17 18:59:00+01', 9, FALSE),
    (9, '2026-12-21 00:00:00+01', '2026-12-24 18:59:00+01', 10, FALSE),
    -- January is blocked
    (10, '2027-01-04 00:00:00+01', '2027-01-07 18:59:00+01', 12, TRUE),
    (11, '2027-01-11 00:00:00+01', '2027-01-14 18:59:00+01', 14, TRUE),
    (12, '2027-01-18 00:00:00+01', '2027-01-21 18:59:00+01', 15, TRUE),
    (13, '2027-01-25 00:00:00+01', '2027-01-28 18:59:00+01', 16, TRUE),
    -- February onwards
    (14, '2027-02-01 00:00:00+01', '2027-02-04 18:59:00+01', 17, FALSE),
    (15, '2027-02-08 00:00:00+01', '2027-02-11 18:59:00+01', 18, FALSE),
    (16, '2027-02-15 00:00:00+01', '2027-02-18 18:59:00+01', 19, FALSE),
    (17, '2027-02-22 00:00:00+01', '2027-02-25 18:59:00+01', 20, FALSE),
    (18, '2027-03-01 00:00:00+01', '2027-03-04 18:59:00+01', 21, FALSE),
    (19, '2027-03-08 00:00:00+01', '2027-03-11 18:59:00+01', 22, FALSE),
    (20, '2027-03-15 00:00:00+01', '2027-03-18 18:59:00+01', 23, FALSE),
    (21, '2027-03-29 00:00:00+02', '2027-04-01 18:59:00+02', 24, FALSE),
    (22, '2027-04-05 00:00:00+02', '2027-04-08 18:59:00+02', 25, FALSE),
    (23, '2027-04-12 00:00:00+02', '2027-04-15 18:59:00+02', 26, FALSE),
    (24, '2027-04-19 00:00:00+02', '2027-04-22 18:59:00+02', 27, FALSE);

-- =============================================================================
-- PLAYER ALIASES (ESPN name variations for fuzzy matching)
-- Add common variations that ESPN might use
-- =============================================================================
INSERT INTO player_aliases (player_id, alias, source) VALUES
    ('psg-lautaro-martinez', 'Lautaro', 'espn'),
    ('psg-lautaro-martinez', 'L. Martinez', 'espn'),
    ('sf-m.-thuram', 'Marcus Thuram', 'espn'),
    ('sf-m.-thuram', 'Thuram', 'espn'),
    ('am-k.-thuram', 'Khephren Thuram', 'espn'),
    ('ym-milinkovic-savic-v.', 'Milinkovic-Savic', 'espn'),
    ('ym-milinkovic-savic-v.', 'V. Milinkovic-Savic', 'espn'),
    ('ym-nico-gonzalez', 'Nicolas Gonzalez', 'espn'),
    ('rp-josep-martinez', 'J. Martinez', 'espn'),
    ('dc-s.-esposito', 'Salvatore Esposito', 'espn'),
    ('rp-f.p.-esposito', 'Francesco Pio Esposito', 'espn'),
    ('rp-f.p.-esposito', 'F. Esposito', 'espn'),
    ('st-d.-maldini', 'Daniel Maldini', 'espn'),
    ('rp-el-shaarawy', 'El Shaarawy', 'espn'),
    ('rp-el-shaarawy', 'Stephan El Shaarawy', 'espn'),
    ('psg-de-ketelaere', 'Charles De Ketelaere', 'espn'),
    ('psg-goncalo-ramos', 'G. Ramos', 'espn'),
    ('rp-che-adams', 'Adams', 'espn'),
    ('le-kolo-muani', 'Randal Kolo Muani', 'espn'),
    ('ap-mctominay', 'Scott McTominay', 'espn')
ON CONFLICT (alias, source) DO NOTHING;
