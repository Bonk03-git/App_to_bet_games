import json
from datetime import datetime, timedelta
from deep_translator import GoogleTranslator

def translate_and_convert_json(input_filename, output_sql_filename):
    # Inicjalizacja tłumacza (z angielskiego na polski)
    translator = GoogleTranslator(source='en', target='pl')
    
    try:
        with open(input_filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Dobieramy się bezpośrednio do listy meczów ukrytej pod kluczem "matches"
            matches = data['matches']
    except FileNotFoundError:
        print(f"Błąd: Nie znaleziono pliku {input_filename}")
        return
    except KeyError:
        print(f"Błąd: Struktura pliku jest niepoprawna. Brak klucza 'matches'.")
        return

    sql_statements = []
    # Cache tłumaczeń, żeby nie tłumaczyć tego samego państwa wielokrotnie
    translated_cache = {}

    print(f"Przetwarzanie {len(matches)} meczów...")

    for m in matches:
        # --- 1. TŁUMACZENIE NAZW ZESPOŁÓW ---
        teams = [m['team1'], m['team2']]
        translated_teams = []
        
        for team in teams:
            if team not in translated_cache:
                translated_cache[team] = translator.translate(team)
            translated_teams.append(translated_cache[team])
        
        home_pl, away_pl = translated_teams

        # --- 2. DYNAMICZNE PRZELICZANIE CZASU ---
        # Format: "13:00 UTC-6" -> wyciągamy godzinę i offset
        time_parts = m['time'].split(' ')
        time_str = time_parts[0]  # "13:00"
        offset_str = time_parts[1].replace('UTC', '')  # "-6" lub "-4"
        
        # Obliczamy różnicę względem Polski (Polska w czerwcu to UTC+2)
        # Różnica = 2 - offset. Dla UTC-6: 2 - (-6) = 8h. Dla UTC-4: 2 - (-4) = 6h.
        try:
            offset_val = int(offset_str)
            diff_to_pl = 2 - offset_val
        except ValueError:
            diff_to_pl = 7  # W razie błędu domyślny bezpieczny offset dla USA Central

        full_dt_str = f"{m['date']} {time_str}"
        dt_obj = datetime.strptime(full_dt_str, "%Y-%m-%d %H:%M")
        pl_time = dt_obj + timedelta(hours=diff_to_pl)

        # --- 3. GENEROWANIE SQL ---
        sql = f"INSERT INTO matches (home_team, away_team, match_time) VALUES ('{home_pl}', '{away_pl}', '{pl_time}');"
        sql_statements.append(sql)

    # Zapis do pliku wynikowego
    with open(output_sql_filename, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_statements))
    
    print(f"Gotowe! Wygenerowano {len(sql_statements)} linii w pliku {output_sql_filename}")

# Uruchomienie skryptu
translate_and_convert_json('worldcup.json', 'wynik.sql')