import React, { useState, useEffect } from 'react';
import axios from 'axios';

function NeedlText() {
  // ------------------ State Variables ------------------
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [chiefComplaintSuggestions, setChiefComplaintSuggestions] = useState([]);
  const [showComplaintSuggestions, setShowComplaintSuggestions] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  // Q&A flow
  const [askedCategories, setAskedCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [context, setContext] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionType, setQuestionType] = useState('text');
  const [questionOptions, setQuestionOptions] = useState([]);
  const [questionConditionals, setQuestionConditionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // For text answers
  const [answerInput, setAnswerInput] = useState('');

  // For conditional questions (Yes / No → possibly details)
  const [selectedYesNo, setSelectedYesNo] = useState(null);
  const [conditionalInput, setConditionalInput] = useState('');
  const [conditionalSuggestions, setConditionalSuggestions] = useState([]);
  const [showConditionalSection, setShowConditionalSection] = useState(false);

  // ------------------ useEffect: Fetch All Categories on Mount ------------------
  useEffect(() => {
    getCategories();
  }, []);

  // ------------------ 1) getCategories ------------------
  const getCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/get_categories');
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setAuthError('Error fetching categories. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------ 2) Chief Complaint Autocomplete Logic ------------------
  const handleChiefComplaintChange = async (e) => {
    const value = e.target.value;
    setChiefComplaint(value);

    if (!value.trim()) {
      setChiefComplaintSuggestions([]);
      setShowComplaintSuggestions(false);
      return;
    }

    if (value === lastQuery) return;
    setLastQuery(value);

    try {
      const res = await axios.post('http://localhost:5000/autocomplete', {
        query: value,
      });
      if (res.data.options) {
        setChiefComplaintSuggestions(res.data.options);
        setShowComplaintSuggestions(true);
      }
    } catch (err) {
      console.error('Chief complaint autocomplete error:', err);
    }
  };

  const handleSelectChiefComplaintSuggestion = (sugg) => {
    setChiefComplaint(sugg);
    setChiefComplaintSuggestions([]);
    setShowComplaintSuggestions(false);
    setLastQuery('');
  };

  const handleSubmitChiefComplaint = async () => {
    if (!chiefComplaint.trim()) {
      alert('Please enter a chief complaint.');
      return;
    }
    setLoading(true);
    try {
      // 1) Predict category
      const res = await axios.post('http://localhost:5000/predict_category', {
        complaint: chiefComplaint,
      });
      const predictedCategory = res.data.category;
      if (predictedCategory) {
        if (!askedCategories.includes(predictedCategory)) {
          setAskedCategories([...askedCategories, predictedCategory]);
        }
        // 2) set context (like "Chief complaint: x. ")
        const newContext = `Chief complaint: ${chiefComplaint}. `;
        setContext(newContext);
        setCurrentCategory(predictedCategory);

        // 3) ask questions for that category
        askQuestions(predictedCategory, newContext);
      } else {
        // fallback: pick first category if available
        if (categories.length > 0) {
          const fallbackCat = categories[0];
          setCurrentCategory(fallbackCat);
          const newCtx = `Chief complaint: ${chiefComplaint}. `;
          setContext(newCtx);
          askQuestions(fallbackCat, newCtx);
        } else {
          alert('No category predicted or found. Please check your setup.');
        }
      }
    } catch (err) {
      console.error('Error predicting category:', err);
      setAuthError('Error predicting category. See console.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------ 3) Ask Questions ------------------
  const askQuestions = async (cat, ctx) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/ask_questions', {
        category: cat,
        context: ctx,
      });
      if (res.data.next_question) {
        setCurrentQuestion(res.data.next_question);
        setQuestionType(res.data.type || 'text');
        setQuestionOptions(res.data.options || []);
        setQuestionConditionals(res.data.conditionals || []);
      } else {
        setCurrentQuestion('');
        setQuestionType('text');
        setQuestionOptions([]);
        setQuestionConditionals([]);
      }
    } catch (err) {
      console.error('Error asking questions:', err);
      alert('Error in /ask_questions. See console.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------ 4) Submit Answer ------------------
  const handleSubmitAnswer = async (answer) => {
    if (!currentQuestion) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/submit_answer', {
        answer: answer || '',
        category: currentCategory,
        context,
        current_question: currentQuestion,
        asked_categories: askedCategories,
      });

      setContext(res.data.context || context);
      setCurrentCategory(res.data.category || currentCategory);
      setAskedCategories(res.data.asked_categories || askedCategories);

      if (res.data.next_question) {
        setCurrentQuestion(res.data.next_question);
        setQuestionType(res.data.type || 'text');
        setQuestionOptions(res.data.options || []);
        setQuestionConditionals(res.data.conditionals || []);
      } else if (res.data.category) {
        // continue same category or new predicted category
        askQuestions(res.data.category, res.data.context || context);
      } else {
        // done
        setCurrentQuestion('');
        setQuestionType('text');
        setQuestionOptions([]);
        setQuestionConditionals([]);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      alert('Error in /submit_answer. See console.');
    } finally {
      setLoading(false);
      setAnswerInput('');
      setSelectedYesNo(null);
      setConditionalInput('');
      setConditionalSuggestions([]);
      setShowConditionalSection(false);
    }
  };

  // ------------------ 5) Skip Question ------------------
  const handleSkipQuestion = () => {
    handleSubmitAnswer('Skipped');
  };

  // ------------------ 6) Skip Category ------------------
  const handleSkipCategory = async () => {
    if (currentCategory && !askedCategories.includes(currentCategory)) {
      setAskedCategories([...askedCategories, currentCategory]);
    }
    // predict next category
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/predict_next_category', {
        context,
        asked_categories: askedCategories,
      });
      const predicted = res.data.category;
      if (predicted && !askedCategories.includes(predicted)) {
        setCurrentCategory(predicted);
        askQuestions(predicted, context);
      } else {
        // move to part2 or done
        // call askQuestions('part2', context)
        askQuestions('part2', context);
      }
    } catch (err) {
      console.error('Error skipping category:', err);
      alert('Error skipping category. See console.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------ 7) Conditional (Yes/No) Handling ------------------
  const handleYesNoClick = (answer) => {
    setSelectedYesNo(answer);
    if (answer === 'Yes') {
      setShowConditionalSection(true);
    } else {
      setShowConditionalSection(false);
      // immediately submit "No"
      handleSubmitAnswer('No');
    }
  };

  // Autocomplete for the conditional input
  const handleConditionalInputChange = async (e) => {
    const value = e.target.value;
    setConditionalInput(value);
    if (!value.trim()) {
      setConditionalSuggestions([]);
      return;
    }

    try {
      const res = await axios.post('http://localhost:5000/autocomplete', {
        query: value,
        question: currentQuestion,
        context,
        conditional_question: true,
      });
      setConditionalSuggestions(res.data.options || []);
    } catch (err) {
      console.error('Error in conditional autocomplete:', err);
    }
  };

  const handleSelectConditionalSuggestion = (suggestion) => {
    setConditionalInput(suggestion);
    setConditionalSuggestions([]);
  };

  const handleSubmitConditional = () => {
    if (!conditionalInput.trim()) {
      alert('Please provide details for your answer.');
      return;
    }
    // Submit "Yes - details"
    const finalAnswer = `Yes - ${conditionalInput}`;
    handleSubmitAnswer(finalAnswer);
  };

  // ------------------ 8) Generate Summary ------------------
  const handleGenerateSummary = async () => {
    if (!context) {
      alert('No context to summarize.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/generate_summary', {
        context,
      });
      if (res.data.success) {
        alert('Summary:\n\n' + res.data.summary);
      } else {
        alert('Error generating summary: ' + (res.data.error || 'Unknown'));
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      alert('Error generating summary. See console.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------ Render UI ------------------
  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <header>
          <h1 style={styles.h1}>needl form v1</h1>
        </header>
        <main>
          {/* Chief Complaint Input */}
          <section style={styles.chiefComplaintSection}>
            <div style={styles.inputGroup}>
              <label htmlFor="chief_complaint">Enter the chief complaint:</label>
              <div style={styles.inputWrapper}>
                <input
                  type="text"
                  id="chief_complaint"
                  placeholder="Type your chief complaint here..."
                  value={chiefComplaint}
                  onChange={handleChiefComplaintChange}
                  style={styles.textInput}
                  onFocus={() => setShowComplaintSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowComplaintSuggestions(false), 200);
                  }}
                />
                {showComplaintSuggestions && chiefComplaintSuggestions.length > 0 && (
                  <ul style={styles.suggestions}>
                    {chiefComplaintSuggestions.map((sugg, idx) => (
                      <li
                        key={idx}
                        style={styles.suggestionItem}
                        onMouseDown={() => handleSelectChiefComplaintSuggestion(sugg)}
                      >
                        {sugg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                id="submit-chief-complaint"
                style={{ ...styles.btn, ...styles.primaryBtn, marginTop: 10 }}
                onClick={handleSubmitChiefComplaint}
              >
                Submit
              </button>
            </div>
          </section>

          {/* Errors */}
          {authError && (
            <div style={{ color: 'red', marginBottom: 20 }}>
              {authError}
            </div>
          )}

          {/* Questions Container */}
          <section id="questions_container" style={styles.questionsSection}>
            {/* If we have a currentCategory, show it at top */}
            {currentCategory && (
              <div style={styles.categoryDisplay}>
                Current Category: {currentCategory}
              </div>
            )}

            {/* If we have a current question, display it */}
            {currentQuestion ? (
              <div>
                <h2 style={styles.qTitle}>{currentQuestion}</h2>

                {/* If we have conditionals, show Yes/No buttons */}
                {questionConditionals && questionConditionals.length > 0 ? (
                  <div>
                    <div style={styles.yesNoContainer}>
                      <button
                        className={`yes-no-btn ${selectedYesNo === 'Yes' ? 'selected' : ''}`}
                        style={{
                          ...styles.yesNoBtn,
                          ...(selectedYesNo === 'Yes'
                            ? { background: '#2575fc', color: '#fff' }
                            : {}),
                        }}
                        onClick={() => handleYesNoClick('Yes')}
                      >
                        Yes
                      </button>
                      <button
                        className={`yes-no-btn ${selectedYesNo === 'No' ? 'selected' : ''}`}
                        style={{
                          ...styles.yesNoBtn,
                          ...(selectedYesNo === 'No'
                            ? { background: '#2575fc', color: '#fff' }
                            : {}),
                        }}
                        onClick={() => handleYesNoClick('No')}
                      >
                        No
                      </button>
                    </div>
                    {showConditionalSection && (
                      <div style={styles.conditionalSection}>
                        <div style={styles.conditionalInputWrapper}>
                          <input
                            type="text"
                            id="conditional-input"
                            placeholder="Please provide details..."
                            value={conditionalInput}
                            onChange={handleConditionalInputChange}
                            style={styles.conditionalInput}
                          />
                          <button
                            id="submit-conditional"
                            style={styles.submitBtn}
                            onClick={handleSubmitConditional}
                          >
                            Submit
                          </button>
                        </div>

                        {/* conditional suggestions */}
                        {conditionalSuggestions.length > 0 && (
                          <ul style={styles.suggestionsContainer}>
                            {conditionalSuggestions.map((item, i) => (
                              <li
                                key={i}
                                style={styles.suggestionItem}
                                onMouseDown={() => handleSelectConditionalSuggestion(item)}
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // Normal question
                  <div>
                    {/* If we have questionOptions, render them as buttons */}
                    {questionOptions && questionOptions.length > 0 ? (
                      <div style={styles.optionsContainer}>
                        {questionOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            style={styles.answerBtn}
                            onClick={() => handleSubmitAnswer(opt)}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      // If no options, show text input
                      <div style={styles.inputContainer}>
                        <input
                          type="text"
                          id="question-input"
                          style={styles.questionInput}
                          placeholder="Type your answer"
                          value={answerInput}
                          onChange={(e) => setAnswerInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSubmitAnswer(answerInput);
                            }
                          }}
                        />
                        <div style={styles.suggestionsContainer}></div>
                      </div>
                    )}

                    {/* Submit button for text */}
                    {(!questionOptions || questionOptions.length === 0) && (
                      <button
                        id="submit-answer"
                        style={{ ...styles.submitBtn, marginTop: 10 }}
                        onClick={() => handleSubmitAnswer(answerInput)}
                      >
                        Submit
                      </button>
                    )}
                  </div>
                )}

                {/* Skip buttons */}
                <div style={styles.buttonContainer}>
                  <button
                    id="skip-question"
                    style={styles.skipBtn}
                    onClick={handleSkipQuestion}
                  >
                    Skip Question
                  </button>
                  <button
                    id="skip-category"
                    style={styles.skipBtn}
                    onClick={handleSkipCategory}
                  >
                    Skip Category
                  </button>
                </div>
              </div>
            ) : (
              // If no currentQuestion but we have a currentCategory => maybe done
              currentCategory && (
                <div>
                  <p>No more questions in this category (or done). Generate summary?</p>
                  <button
                    id="generate-summary"
                    style={styles.submitBtn}
                    onClick={handleGenerateSummary}
                  >
                    Generate Summary
                  </button>
                </div>
              )
            )}
          </section>

          {/* Debug / Context */}
          {context && (
            <div style={styles.debugBox}>
              <h4>Context (debug):</h4>
              <pre style={styles.debugPre}>{context}</pre>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ------------------ Inline Styles (Mimicking your CSS) ------------------
const styles = {
  body: {
    fontFamily: "'Roboto', sans-serif",
    background: 'linear-gradient(135deg, #f0f4f8, #d9e2ec)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    background: '#fff',
    borderRadius: '15px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
    maxWidth: '800px',
    width: '90%',
    padding: '30px',
    animation: 'fadeIn 1s ease-in-out',
  },
  h1: {
    textAlign: 'center',
    fontFamily: "'Montserrat', sans-serif",
    marginBottom: '20px',
    color: '#2c3e50',
  },
  chiefComplaintSection: {
    marginBottom: '30px',
  },
  inputGroup: {
    position: 'relative',
    marginBottom: '30px',
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    width: '100%',
    padding: '12px 20px',
    border: '2px solid #ccc',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.3s',
    outline: 'none',
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#fff',
    border: '1px solid #ccc',
    borderTop: 'none',
    maxHeight: '200px',
    overflowY: 'auto',
    borderRadius: '0 0 8px 8px',
    zIndex: 1000,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  suggestionItem: {
    padding: '10px 20px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btn: {
    display: 'inline-block',
    padding: '12px 25px',
    border: 'none',
    borderRadius: '50px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background 0.3s, transform 0.2s',
    marginTop: '15px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
    color: '#fff',
  },
  questionsSection: {
    padding: '20px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  },
  categoryDisplay: {
    background: 'linear-gradient(135deg, #f6f8fa, #e9ecef)',
    padding: '12px 20px',
    marginBottom: '20px',
    borderRadius: '8px',
    fontWeight: 500,
    color: '#2c3e50',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  qTitle: {
    marginBottom: '15px',
    color: '#34495e',
    fontSize: '1.25rem',
    lineHeight: 1.4,
  },
  yesNoContainer: {
    display: 'flex',
    gap: '12px',
    margin: '20px 0',
  },
  yesNoBtn: {
    padding: '12px 30px',
    fontSize: '16px',
    border: '2px solid #2575fc',
    borderRadius: '8px',
    background: 'white',
    color: '#2575fc',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    minWidth: '120px',
  },
  conditionalSection: {
    marginTop: '20px',
    padding: '20px',
    background: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e1e8ed',
  },
  conditionalInputWrapper: {
    display: 'flex',
    gap: '12px',
    marginBottom: '10px',
  },
  conditionalInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e1e8ed',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  submitBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #2575fc, #6a11cb)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 500,
    transition: 'all 0.3s ease',
  },
  suggestionsContainer: {
    marginTop: '8px',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    maxHeight: '200px',
    overflowY: 'auto',
    background: 'white',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    listStyle: 'none',
    padding: 0,
  },
  inputContainer: {
    margin: '20px 0',
  },
  questionInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e1e8ed',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  optionsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    margin: '20px 0',
  },
  answerBtn: {
    padding: '12px 24px',
    background: '#f8f9fa',
    color: '#2c3e50',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
  },
  buttonContainer: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  skipBtn: {
    padding: '12px 24px',
    background: '#f8f9fa',
    color: '#2c3e50',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
  },
  debugBox: {
    marginTop: '30px',
    padding: '20px',
    background: '#ececec',
    borderRadius: '8px',
  },
  debugPre: {
    maxHeight: '300px',
    overflowY: 'auto',
    background: '#fff',
    padding: '10px',
  },
};

export default NeedlText;
