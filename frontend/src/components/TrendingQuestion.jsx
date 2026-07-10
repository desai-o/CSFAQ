function TrendingQuestion({
  title,
  author,
  votes,
  answers,
  category,
}) {
  return (
    <div className="question-card">
      <div className="question-votes">
        <button className="upvote">▲</button>
        <span>{votes}</span>
      </div>

      <div className="question-content">
        <h3>{title}</h3>

        <div className="question-meta">
          <span>{author}</span>
          <span>•</span>
          <span>{category}</span>
        </div>
      </div>

      <div className="question-answers">
        {answers} answers
      </div>
    </div>
  );
}

export default TrendingQuestion;