-- A user to test with, password is 'Pass1234'
INSERT INTO users(username, password, name, email)
VALUES ('testuser', '$2a$10$mPxN78ZmwVhvqfjmFSjZ9empoNps8A5b..G8qI94Eb/x1CqnksQuS', 'Test User', 'fortest@fakedomain.com');

INSERT INTO userSavings(username, savings)
VALUES ('testuser', 4556.88);