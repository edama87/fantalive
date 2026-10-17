-- 20 alias ESPN puntavano ai vecchi id (giocatori del seed, ora is_active = false):
-- li spostiamo sugli id attuali per nome, ed eliminiamo quelli ambigui o obsoleti.
-- I 7 alias 'fms' puntano già a giocatori attivi e non si toccano.

UPDATE player_aliases AS a
SET player_id = m.new_id
FROM (VALUES
    ('Charles De Ketelaere', 'de-ketelaere-charles-a'),
    ('Daniel Maldini', 'maldini-daniel-a'),
    ('El Shaarawy', 'el-shaarawy-stephan-c'),
    ('Stephan El Shaarawy', 'el-shaarawy-stephan-c'),
    ('F. Esposito', 'esposito-francesco-pio-a'),
    ('Francesco Pio Esposito', 'esposito-francesco-pio-a'),
    ('G. Ramos', 'ramos-goncalo-matias-a'),
    ('J. Martinez', 'martinez-josep-p'),
    ('L. Martinez', 'martinez-lautaro-javier-a'),
    ('Lautaro', 'martinez-lautaro-javier-a'),
    ('Khephren Thuram', 'thuram-khephren-c'),
    ('Marcus Thuram', 'thuram-marcus-lilian-a'),
    ('Milinkovic-Savic', 'milinkovic-savic-vanja-p'),
    ('V. Milinkovic-Savic', 'milinkovic-savic-vanja-p'),
    ('Nicolas Gonzalez', 'gonzalez-nicolas-ivan-c'),
    ('Randal Kolo Muani', 'kolo-muani-randal-a'),
    ('Scott McTominay', 'mctominay-scott-francis-c')
) AS m(alias, new_id)
WHERE a.source = 'espn'
  AND a.alias = m.alias
  AND EXISTS (SELECT 1 FROM players p WHERE p.id = m.new_id AND p.is_active);

-- Ambigui senza squadra ('Adams': Torino e Venezia; 'Thuram': Inter e Juventus)
-- o senza giocatore attivo ('Salvatore Esposito'): il matcher per nome+squadra li gestisce.
DELETE FROM player_aliases
WHERE source = 'espn'
  AND alias IN ('Adams', 'Thuram', 'Salvatore Esposito')
  AND player_id IN (SELECT id FROM players WHERE NOT is_active);

-- Qualsiasi altro alias rimasto su un giocatore non attivo è obsoleto.
DELETE FROM player_aliases
WHERE player_id IN (SELECT id FROM players WHERE NOT is_active);
