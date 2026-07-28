import secrets
import json
import os
import sys
from datetime import date

def generate_random_id():
    return secrets.token_hex(32)

def modify_jsonl_file(file_path, output_file_path):
    modified_data = []
    with open(file_path, 'r') as file:
        for line in file:
            json_obj = json.loads(line)
            json_obj['id'] = generate_random_id()
            modified_data.append(json_obj)

    with open(f"{output_file_path}{generate_random_id()}.json", 'w') as file:
        for json_obj in modified_data:
            file.write(json.dumps(json_obj) + '\n')

default_input_file = './default_file/02023-adb5b697-1c43-469b-b740-1945f4217a3e.c000.json'
oversized_input_file = './default_file/oversized_line.json'
all_families = ['dae', 'bac', 'over']

# Accept families as CLI args: python main.py dae bac
# Falls back to all families if none provided
requested = [f for f in sys.argv[1:] if f in all_families]
feature_families = requested if requested else all_families

today = date.today()

for partition, feature_family in enumerate(feature_families):
    input_file = oversized_input_file if feature_family == 'over' else default_input_file
    output_dir = f'./features/feature_family={feature_family}/date_part={today}/partition={partition}/'
    os.makedirs(output_dir, exist_ok=True)
    print(output_dir)
    modify_jsonl_file(input_file, output_dir)
