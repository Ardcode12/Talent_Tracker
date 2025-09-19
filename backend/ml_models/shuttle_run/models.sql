-- Users (optional)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Posts
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Assessments
CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Assessment Results
CREATE TABLE assessment_results (
    id SERIAL PRIMARY KEY,
    assessment_id INT REFERENCES assessments(id) ON DELETE CASCADE,
    analysis JSONB,
    probabilities JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
