-- FantaLive Bundlesliga - Seed Data
-- Initial teams, players, rounds, and roster versions

-- =============================================================================
-- TEAMS
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
    ('dc', 'Dinamo Cecchignola 1927', 'Christian P.', NULL);

-- =============================================================================
-- PLAYERS (sample - full list would be much longer)
-- =============================================================================

-- Yellow Mustard
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
    ('ym-stulic', 'Stulic', 'A', NULL);

-- Amatori ProSecco (user's team)
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
    ('ap-lauriente', 'Laurienté', 'A', 'Lazio'),
    ('ap-toure', 'Touré', 'A', NULL),
    ('ap-varela', 'Varela', 'A', NULL),
    ('ap-lontani', 'Lontani', 'A', NULL),
    ('ap-woltemade', 'Woltemade', 'A', NULL);

-- Dinamo Cecchignola 1927
INSERT INTO players (id, name, role, real_team) VALUES
    ('dc-desplanches', 'Desplanches', 'P', NULL),
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
    ('dc-calo', 'Calò', 'C', NULL),
    ('dc-cisse', 'Cissé', 'C', NULL),
    ('dc-da-cunha', 'Da Cunha', 'C', NULL),
    ('dc-fagioli', 'Fagioli', 'C', 'Juventus'),
    ('dc-mandragora', 'Mandragora', 'C', 'Fiorentina'),
    ('dc-pobega', 'Pobega', 'C', 'Bologna'),
    ('dc-rovella', 'Rovella', 'C', 'Lazio'),
    ('dc-dybala', 'Dybala', 'A', 'Roma'),
    ('dc-s-esposito', 'S. Esposito', 'A', 'Empoli'),
    ('dc-kvernadze', 'Kvernadze', 'A', NULL),
    ('dc-raimondo', 'Raimondo', 'A', NULL),
    ('dc-robinson', 'Robinson', 'A', NULL),
    ('dc-osmajic', 'Osmajic', 'A', NULL);

-- Little Eagles
INSERT INTO players (id, name, role, real_team) VALUES
    ('le-maignan', 'Maignan', 'P', 'Milan'),
    ('le-terracciano', 'Terracciano', 'P', 'Fiorentina'),
    ('le-torriani', 'Torriani', 'P', NULL),
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
    ('le-kolo-muani', 'Kolo Muani', 'A', 'Juventus');

-- Salen Team
INSERT INTO players (id, name, role, real_team) VALUES
    ('st-carnesecchi', 'Carnesecchi', 'P', 'Atalanta'),
    ('st-sportiello', 'Sportiello', 'P', NULL),
    ('st-pompei', 'Pompei', 'P', NULL),
    ('st-bartesaghi', 'Bartesaghi', 'D', NULL),
    ('st-cittadini', 'Cittadini', 'D', NULL),
    ('st-correia', 'Correia', 'D', NULL),
    ('st-delprato', 'Delprato', 'D', 'Parma'),
    ('st-gallo', 'Gallo', 'D', NULL),
    ('st-marin', 'Marin', 'D', NULL),
    ('st-wesley', 'Wesley', 'D', NULL),
    ('st-couto', 'Couto', 'D', NULL),
    ('st-busio', 'Busio', 'C', 'Venezia'),
    ('st-calhanoglu', 'Calhanoglu', 'C', 'Inter'),
    ('st-colpani', 'Colpani', 'C', 'Fiorentina'),
    ('st-de-roon', 'De Roon', 'C', 'Atalanta'),
    ('st-frattesi', 'Frattesi', 'C', 'Inter'),
    ('st-keita', 'Keita', 'C', NULL),
    ('st-rowe', 'Rowe', 'C', NULL),
    ('st-vergara', 'Vergara', 'C', NULL),
    ('st-akor-adams', 'Akor Adams', 'A', NULL),
    ('st-douvikas', 'Douvikas', 'A', NULL),
    ('st-d-maldini', 'D. Maldini', 'A', 'Monza'),
    ('st-neres', 'Neres', 'A', 'Napoli'),
    ('st-piccoli', 'Piccoli', 'A', 'Cagliari'),
    ('st-raspadori', 'Raspadori', 'A', 'Napoli');

-- =============================================================================
-- ROUNDS (first 9 rounds as example)
-- =============================================================================
INSERT INTO rounds (number, serie_a_matchday, kickoff_date, pairing_cycle, is_home_swapped, lineup_deadline) VALUES
    (1, 7, '2026-10-16', 'A', FALSE, '2026-10-16 17:30:00+02'),
    (2, 8, '2026-10-23', 'B', FALSE, '2026-10-23 17:30:00+02'),
    (3, 9, '2026-10-27', 'C', FALSE, '2026-10-27 17:30:00+02'),
    (4, 10, '2026-10-31', 'D', FALSE, '2026-10-31 17:30:00+01'),
    (5, 11, '2026-11-06', 'E', FALSE, '2026-11-06 17:30:00+01'),
    (6, 12, '2026-11-21', 'F', FALSE, '2026-11-21 17:30:00+01'),
    (7, 13, '2026-11-27', 'G', FALSE, '2026-11-27 17:30:00+01'),
    (8, 14, '2026-12-04', 'H', FALSE, '2026-12-04 17:30:00+01'),
    (9, 15, '2026-12-11', 'I', FALSE, '2026-12-11 17:30:00+01');

-- =============================================================================
-- INITIAL ROSTER VERSIONS
-- =============================================================================
INSERT INTO roster_versions (team_id, version_number, effective_from, credits_remaining, market_credits) VALUES
    ('ym', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('am', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('fc', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('sf', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('rp', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('psg', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('le', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('st', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('ap', 1, '2026-10-01 00:00:00+02', 0, 60),
    ('dc', 1, '2026-10-01 00:00:00+02', 0, 60);

-- =============================================================================
-- INITIAL MARKET WINDOWS
-- =============================================================================
INSERT INTO market_windows (week_number, opens_at, closes_at, effective_round, is_january_block) VALUES
    (1, '2026-10-19 00:00:00+02', '2026-10-22 18:59:00+02', 2, FALSE),
    (2, '2026-10-26 00:00:00+02', '2026-10-29 18:59:00+02', 3, FALSE),
    (3, '2026-11-02 00:00:00+01', '2026-11-05 18:59:00+01', 4, FALSE),
    (4, '2026-11-09 00:00:00+01', '2026-11-12 18:59:00+01', 5, FALSE);
