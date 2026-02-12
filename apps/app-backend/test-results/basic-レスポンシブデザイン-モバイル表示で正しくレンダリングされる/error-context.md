# Page snapshot

```yaml
- main [ref=e2]:
  - heading "Welcome to Hono!" [level=1] [ref=e3]
  - article [ref=e4]:
    - strong [ref=e5]: "NODE_ENV:"
    - text: development
  - generic [ref=e6]:
    - heading "EC Shop" [level=2] [ref=e7]
    - button "商品一覧を見る" [ref=e8] [cursor=pointer]
  - generic [ref=e9]:
    - heading "Login" [level=2] [ref=e10]
    - generic [ref=e11]:
      - generic [ref=e12]: Email
      - textbox "Email" [ref=e13]:
        - /placeholder: admin@example.com
      - generic [ref=e14]: Password
      - textbox "Password" [ref=e15]:
        - /placeholder: password
      - button "Login" [ref=e16] [cursor=pointer]
  - generic [ref=e17]:
    - heading "Database Connection Test" [level=2] [ref=e18]
    - generic [ref=e19]:
      - button "PostgreSQL Test" [ref=e20] [cursor=pointer]
      - button "MongoDB Test" [ref=e21] [cursor=pointer]
```