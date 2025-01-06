# text_routes.py

import os
import json
import re
import html
import datetime
import sqlite3
from flask import Blueprint, request, jsonify
from config import Config
from openai import OpenAI

####################################################
# 1) Create Blueprint
####################################################
text_bp = Blueprint("text_bp", __name__)

####################################################
# 2) Global Variables (Populated in app.py)
####################################################
data = {}              # Will hold { categoryName: [questions...] }
part2_questions = []   # Will hold list of part2 question objects

####################################################
# 3) OpenAI Clients
####################################################
openai_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=Config.GROQ_API_KEY
)
GPT_MODEL = Config.GROQ_MODEL  # e.g. "llama-3.1-8b-instant"

summary_client = OpenAI(
    api_key=Config.OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1"
)
SUMMARY_MODEL = Config.OPENROUTER_MODEL  # e.g. "openai/o1-preview"

####################################################
# 4) Database Setup Functions (Called in app.py)
####################################################
def create_tables():
    """
    Re-creates the tables (Categories, Questions, Conditionals, Options)
    by reading 'questions.json' and 'part2.json'.
    """
    conn = sqlite3.connect('questions.db')
    c = conn.cursor()

    c.execute('DROP TABLE IF EXISTS Categories')
    c.execute('DROP TABLE IF EXISTS Questions')
    c.execute('DROP TABLE IF EXISTS Conditionals')
    c.execute('DROP TABLE IF EXISTS Options')

    c.execute('''CREATE TABLE IF NOT EXISTS Categories
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT,
                  source TEXT,
                  UNIQUE(name, source))''')

    c.execute('''CREATE TABLE IF NOT EXISTS Questions
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  category_id INTEGER,
                  question_text TEXT,
                  question_type TEXT,
                  FOREIGN KEY (category_id) REFERENCES Categories (id))''')

    c.execute('''CREATE TABLE IF NOT EXISTS Conditionals
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  question_id INTEGER,
                  condition TEXT,
                  conditional_question_text TEXT,
                  FOREIGN KEY (question_id) REFERENCES Questions (id))''')

    c.execute('''CREATE TABLE IF NOT EXISTS Options
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  question_id INTEGER,
                  option_text TEXT,
                  FOREIGN KEY (question_id) REFERENCES Questions (id))''')

    data_files = ['questions.json', 'part2.json']
    for file_name in data_files:
        if not os.path.exists(file_name):
            print(f"Warning: {file_name} not found, skipping.")
            continue

        with open(file_name, 'r') as f:
            json_data = json.load(f)

        source = file_name
        for category_name, category_data in json_data.items():
            c.execute("INSERT OR IGNORE INTO Categories (name, source) VALUES (?,?)",
                      (category_name, source))
            c.execute("SELECT id FROM Categories WHERE name=? AND source=?",
                      (category_name, source))
            cat_id = c.fetchone()[0]

            if isinstance(category_data, list):
                for qd in category_data:
                    insert_question_and_related_data(c, cat_id, qd)
            elif isinstance(category_data, dict):
                # Possibly subcategories
                for subcat_name, questions_list in category_data.items():
                    for qd in questions_list:
                        qd['question'] = f"{subcat_name}: {qd['question']}"
                        insert_question_and_related_data(c, cat_id, qd)

    conn.commit()
    conn.close()

def insert_question_and_related_data(c, category_id, question_data):
    question_text = question_data['question']
    question_type = question_data.get('type', 'text')
    c.execute("""INSERT INTO Questions (category_id, question_text, question_type)
                 VALUES (?,?,?)""", (category_id, question_text, question_type))
    question_id = c.lastrowid

    if 'options' in question_data:
        for opt in question_data['options']:
            c.execute("INSERT INTO Options (question_id, option_text) VALUES (?,?)",
                      (question_id, opt))

    if 'conditionals' in question_data:
        for cond in question_data['conditionals']:
            cond_condition = cond['condition']
            cond_condition_str = json.dumps(cond_condition) if isinstance(cond_condition, list) else cond_condition
            cond_question = cond['question']
            c.execute("""INSERT INTO Conditionals
                         (question_id, condition, conditional_question_text)
                         VALUES (?,?,?)""", (question_id, cond_condition_str, cond_question))

def load_questions():
    """
    Loads data from 'questions.db' that came from 'questions.json'.
    Returns a dict { categoryName: [ {question, type, options, conditionals}, ... ] }
    """
    conn = sqlite3.connect('questions.db')
    c = conn.cursor()

    c.execute("SELECT * FROM Categories WHERE source=?", ('questions.json',))
    categories_db = c.fetchall()

    local_data = {}
    for cat in categories_db:
        cat_id, cat_name, cat_src = cat
        local_data[cat_name] = []

        c.execute("SELECT * FROM Questions WHERE category_id=?", (cat_id,))
        questions = c.fetchall()
        for q in questions:
            q_id, _, q_text, q_type = q
            qd = {'question': q_text, 'type': q_type}

            # Conditionals
            c.execute("SELECT * FROM Conditionals WHERE question_id=?", (q_id,))
            conds = c.fetchall()
            if conds:
                qd['conditionals'] = []
                for row in conds:
                    _, _, cond_condition, cond_question_text = row
                    try:
                        parsed = json.loads(cond_condition)
                    except:
                        parsed = cond_condition
                    qd['conditionals'].append({
                        'condition': parsed,
                        'question': cond_question_text
                    })

            # Options
            c.execute("SELECT option_text FROM Options WHERE question_id=?", (q_id,))
            opts = c.fetchall()
            if opts:
                qd['options'] = [o[0] for o in opts]

            local_data[cat_name].append(qd)

    conn.close()
    return local_data

def load_part2_questions():
    """
    Loads data from 'part2.json' in the DB. Returns a list of question dicts.
    """
    conn = sqlite3.connect('questions.db')
    c = conn.cursor()

    c.execute("SELECT * FROM Categories WHERE source=?", ('part2.json',))
    categories_db = c.fetchall()

    part2_list = []
    for cat in categories_db:
        cat_id, cat_name, cat_src = cat
        c.execute("SELECT * FROM Questions WHERE category_id=?", (cat_id,))
        questions = c.fetchall()
        for q in questions:
            q_id, _, q_text, q_type = q
            qd = {'question': q_text, 'type': q_type}

            # Conditionals
            c.execute("SELECT * FROM Conditionals WHERE question_id=?", (q_id,))
            conds = c.fetchall()
            if conds:
                qd['conditionals'] = []
                for row in conds:
                    _, _, cond_condition, cond_question_text = row
                    try:
                        parsed = json.loads(cond_condition)
                    except:
                        parsed = cond_condition
                    qd['conditionals'].append({
                        'condition': parsed,
                        'question': cond_question_text
                    })

            # Options
            c.execute("SELECT option_text FROM Options WHERE question_id=?", (q_id,))
            opts = c.fetchall()
            if opts:
                qd['options'] = [o[0] for o in opts]

            part2_list.append(qd)

    conn.close()
    return part2_list

####################################################
# 5) Utility + AI Logic
####################################################

def sanitize_input(text):
    if not isinstance(text, str):
        return ''
    return html.escape(text.strip())

def parse_context(context):
    out = []
    if not context:
        return out
    lines = [x.strip() for x in context.strip().split('. ') if x.strip()]
    for ln in lines:
        ln = ln.strip('. ')
        idx = ln.rfind(': ')
        if idx != -1:
            q = ln[:idx].strip()
            a = ln[idx+2:].strip()
            out.append({'question': q, 'answer': a})
    return out

##############################
# AI-based Autocomplete
##############################
def ai_autocomplete(query, question=None, context_str='', is_conditional=False):
    if not query.strip():
        return []

    try:
        if question:
            # Autocomplete for a partial answer to a specific question
            sys_prompt = "You are helping a patient complete an answer."
            user_prompt = f"Question: {question}\nContext: {context_str}\nPartial answer: {query}\nSuggest possible completions (one per line)."
            if is_conditional:
                user_prompt += "\nThis is a conditional question. Provide relevant detail."

        else:
            # Chief complaint
            sys_prompt = "You are providing suggestions for chief complaints."
            user_prompt = f"Partial chief complaint: {query}\nSuggest possible completions (one per line)."

        res = openai_client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=50
        )
        text = res.choices[0].message.content.strip()
        lines = [x.strip() for x in text.split('\n') if x.strip()]
        return lines[:5]

    except Exception as e:
        print("Error in ai_autocomplete:", e)
        return []

##############################
# AI-based Category Prediction
##############################
def predict_category_ai(complaint):
    if not complaint.strip():
        return None
    # Get categories from DB
    conn = sqlite3.connect('questions.db')
    c = conn.cursor()
    c.execute("SELECT name FROM Categories WHERE source='questions.json'")
    rows = c.fetchall()
    conn.close()
    cat_names = [r[0] for r in rows]

    if not cat_names:
        return None

    sys_prompt = "You are a medical expert. Provide the best match from the list of categories."
    user_prompt = (
        f"Complaint: {complaint}\n"
        f"Categories: {', '.join(cat_names)}\n"
        "Which category is most relevant?"
    )
    try:
        res = openai_client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0
        )
        text = res.choices[0].message.content.strip()
        # find match
        for cn in cat_names:
            if cn.lower() in text.lower():
                return cn
        return None
    except Exception as e:
        print("Error in predict_category_ai:", e)
        return None

def predict_next_category_ai(context_str, asked_cats):
    remain = [cat for cat in data.keys() if cat not in asked_cats]
    if not remain:
        return None

    sys_prompt = "You are a medical assistant. Provide the next best category to explore."
    user_prompt = (
        f"Context: {context_str}\n"
        f"Remaining categories: {', '.join(remain)}\n"
        "Which category is most relevant next?"
    )
    try:
        res = openai_client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0
        )
        text = res.choices[0].message.content.strip()
        for r in remain:
            if r.lower() in text.lower():
                return r
        return None
    except Exception as e:
        print("Error in predict_next_category_ai:", e)
        return None

##############################
# Asking / Submitting Answers
##############################
def ask_questions(category, context_str):
    if category not in data:
        return None
    context_list = parse_context(context_str)
    answered_qs = [x['question'].lower() for x in context_list]

    # 1) main
    for qd in data[category]:
        if qd['question'].lower() not in answered_qs:
            return qd

    # 2) conditionals
    for qd in data[category]:
        if 'conditionals' in qd:
            base_q = qd['question'].lower()
            base_ans = None

            for pair in context_list:
                if pair['question'].lower() == base_q:
                    base_ans = pair['answer']
                    break

            if base_ans is None:
                continue

            for cond in qd['conditionals']:
                cond_q = cond['question']
                if cond_q.lower() in answered_qs:
                    continue
                condition = cond['condition']
                match = False
                if isinstance(condition, list):
                    if base_ans in condition:
                        match = True
                else:
                    if base_ans == condition:
                        match = True
                if match:
                    return {
                        'question': cond_q,
                        'type': 'text',
                        'options': [],
                        'conditionals': []
                    }

    return None

def ask_part2_questions(context_str):
    context_list = parse_context(context_str)
    answered = set(x['question'].lower() for x in context_list)
    for qd in part2_questions:
        if qd['question'].lower() not in answered:
            return qd
    return None

##############################
# Summary Generation
##############################
def generate_summary(context_str):
    if not context_str.strip():
        return {"success": False, "error": "No context provided"}

    template = """
HISTORY AND PHYSICAL FINDINGS
CHIEF COMPLAINTS-
{chief_complaints}
HISTORY OF PRESENTING ILLNESS-
{history_of_presenting_illness}
PAST HISTORY:
{past_history}
PERSONAL HISTORY:
{personal_history}
FAMILY HISTORY-
{family_history}
GENERALIZED PHYSICAL EXAMINATION:
{general_physical_exam}
SYSTEMIC EXAMINATION-
{systemic_examination}
"""
    sys_prompt = "You are a medical expert. Generate a thorough summary from the context using this template. Include only relevant info."
    user_prompt = f"Context:\n{context_str}\n\nTemplate:\n{template}"
    try:
        res = summary_client.chat.completions.create(
            model=SUMMARY_MODEL,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=1500
        )
        text = res.choices[0].message.content.strip()
        stamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
        fname = f"summary_{stamp}.txt"
        os.makedirs("summaries", exist_ok=True)
        with open(os.path.join("summaries", fname), 'w') as f:
            f.write(text)

        return {"success": True, "summary": text, "file_path": os.path.join("summaries", fname)}
    except Exception as e:
        print("Error generating summary:", e)
        return {"success": False, "error": str(e)}

####################################################
# 6) Routes
####################################################

@text_bp.route('/autocomplete', methods=['POST'])
def autocomplete():
    body = request.json
    query = body.get('query', '')
    question = body.get('question', '')
    context_str = body.get('context', '')
    is_conditional = body.get('conditional_question', False)

    if not query.strip():
        return jsonify(options=[])

    suggestions = ai_autocomplete(
        query=query,
        question=question,
        context_str=context_str,
        is_conditional=is_conditional
    )
    return jsonify(options=suggestions)

@text_bp.route('/predict_category', methods=['POST'])
def predict_category_route():
    body = request.json
    complaint = body.get('complaint', '')
    if not complaint.strip():
        return jsonify(category=None)

    cat = predict_category_ai(complaint)
    return jsonify(category=cat)

@text_bp.route('/ask_questions', methods=['POST'])
def ask_questions_route():
    body = request.json
    category = body.get('category', '')
    context_str = body.get('context', '')

    if category == 'part2':
        qd = ask_part2_questions(context_str)
    else:
        qd = ask_questions(category, context_str)

    if qd:
        return jsonify(
            next_question=qd['question'],
            type=qd.get('type', 'text'),
            options=qd.get('options', []),
            conditionals=qd.get('conditionals', [])
        )
    else:
        return jsonify(next_question=None)

@text_bp.route('/submit_answer', methods=['POST'])
def submit_answer():
    body = request.json
    answer = body.get('answer', '')
    category = body.get('category', '')
    context_str = body.get('context', '')
    current_question = body.get('current_question', '')
    asked_cats = body.get('asked_categories', [])

    # add to context
    if current_question and answer:
        context_str += f"{current_question}: {answer}. "

    if category != 'part2':
        nxt = ask_questions(category, context_str)
        if nxt:
            return jsonify(
                context=context_str,
                next_question=nxt['question'],
                current_question=nxt['question'],
                category=category,
                type=nxt.get('type', 'text'),
                options=nxt.get('options', []),
                conditionals=nxt.get('conditionals', []),
                asked_categories=asked_cats
            )
        else:
            if category not in asked_cats:
                asked_cats.append(category)
            # pick next category or move to part2
            remain = [c for c in data.keys() if c not in asked_cats]
            if remain:
                next_cat = predict_next_category_ai(context_str, asked_cats)
                if next_cat and next_cat not in asked_cats:
                    asked_cats.append(next_cat)
                if next_cat:
                    nxt_q = ask_questions(next_cat, context_str)
                    if nxt_q:
                        return jsonify(
                            context=context_str,
                            next_question=nxt_q['question'],
                            current_question=nxt_q['question'],
                            category=next_cat,
                            type=nxt_q.get('type', 'text'),
                            options=nxt_q.get('options', []),
                            conditionals=nxt_q.get('conditionals', []),
                            asked_categories=asked_cats
                        )
                    else:
                        return no_questions_left(context_str, asked_cats)
                else:
                    return fallback_no_prediction(context_str, asked_cats)
            else:
                # no main cat => part2
                nxt_q = ask_part2_questions(context_str)
                if nxt_q:
                    return jsonify(
                        context=context_str,
                        next_question=nxt_q['question'],
                        current_question=nxt_q['question'],
                        category='part2',
                        type=nxt_q.get('type', 'text'),
                        options=nxt_q.get('options', []),
                        conditionals=nxt_q.get('conditionals', []),
                        asked_categories=asked_cats
                    )
                else:
                    return jsonify(
                        context=context_str,
                        next_question=None,
                        current_question='',
                        category=None,
                        asked_categories=asked_cats
                    )
    else:
        # part2
        nxt = ask_part2_questions(context_str)
        if nxt:
            return jsonify(
                context=context_str,
                next_question=nxt['question'],
                current_question=nxt['question'],
                category='part2',
                type=nxt.get('type', 'text'),
                options=nxt.get('options', []),
                conditionals=nxt.get('conditionals', []),
            )
        else:
            return jsonify(
                context=context_str,
                next_question=None,
                current_question='',
                category=None,
                asked_categories=asked_cats
            )

def fallback_no_prediction(context_str, asked_cats):
    remain = [c for c in data.keys() if c not in asked_cats]
    if not remain:
        return move_to_part2(context_str, asked_cats)
    else:
        cat = remain[0]
        if cat not in asked_cats:
            asked_cats.append(cat)
        nxt_q = ask_questions(cat, context_str)
        if nxt_q:
            return jsonify(
                context=context_str,
                next_question=nxt_q['question'],
                current_question=nxt_q['question'],
                category=cat,
                type=nxt_q.get('type', 'text'),
                options=nxt_q.get('options', []),
                conditionals=nxt_q.get('conditionals', []),
                asked_categories=asked_cats
            )
        else:
            return fallback_no_prediction(context_str, asked_cats)

def no_questions_left(context_str, asked_cats):
    return fallback_no_prediction(context_str, asked_cats)

def move_to_part2(context_str, asked_cats):
    nxt_q = ask_part2_questions(context_str)
    if nxt_q:
        return jsonify(
            context=context_str,
            next_question=nxt_q['question'],
            current_question=nxt_q['question'],
            category='part2',
            type=nxt_q.get('type', 'text'),
            options=nxt_q.get('options', []),
            conditionals=nxt_q.get('conditionals', []),
            asked_categories=asked_cats
        )
    else:
        return jsonify(
            context=context_str,
            next_question=None,
            current_question='',
            category=None,
            asked_categories=asked_cats
        )

@text_bp.route('/predict_next_category', methods=['POST'])
def predict_next_category_route():
    body = request.json
    context_str = body.get('context', '')
    asked_cats = body.get('asked_categories', [])
    cat = predict_next_category_ai(context_str, asked_cats)
    return jsonify(category=cat)

@text_bp.route('/generate_summary', methods=['POST'])
def generate_summary_route():
    body = request.json
    context_str = body.get('context', '')
    result = generate_summary(context_str)
    return jsonify(result)
