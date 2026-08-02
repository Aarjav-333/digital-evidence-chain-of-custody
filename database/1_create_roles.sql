CREATE TABLE roles (
    role_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    role_name VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO roles (role_name)
VALUES
('System Administrator'),
('Police Officer'),
('Case Manager'),
('Forensic Analyst');
SELECT * FROM roles;