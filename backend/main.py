"""
main.py — CLI Entry Point
---------------------------
How:  Simple menu loop that calls auth.py functions.
Why:  Demonstrates the vertical slice without a browser.
"""

from auth import register_user, login_user, logout_user, session
from db_connection import get_connection, close_connection


def fetch_songs():
    """Query and print all songs from the Songs table."""
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT title, artist, album, genre FROM Songs;")
        rows = cur.fetchall()
        if not rows:
            print("\n  No songs found. Insert some via pgAdmin.")
            return
        print(f"\n  {'Title':<30} {'Artist':<25} {'Album':<25} {'Genre':<15}")
        print("  " + "-" * 95)
        for r in rows:
            print(f"  {r[0]:<30} {r[1]:<25} {r[2] or '':<25} {r[3] or '':<15}")
    except Exception as e:
        print(f"  Error: {e}")
    finally:
        close_connection(conn)


def main():
    while True:
        print("\n=== Audio-Draft ===")
        if session["logged_in"]:
            print(f"  Logged in as: {session['username']}")
        print("  1) Register")
        print("  2) Login")
        print("  3) Fetch Songs")
        print("  4) Logout")
        print("  5) Exit")

        choice = input("  > ").strip()

        if choice == "1":
            u = input("  Username: ").strip()
            e = input("  Email: ").strip()
            p = input("  Password: ").strip()
            try:
                register_user(u, e, p)
                print("  Registered!")
            except Exception as ex:
                print(f"  Failed: {ex}")

        elif choice == "2":
            if session["logged_in"]:
                print("  Already logged in.")
                continue
            e = input("  Email: ").strip()
            p = input("  Password: ").strip()
            result = login_user(e, p)
            print("  Welcome!" if result else "  Invalid credentials.")

        elif choice == "3":
            if not session["logged_in"]:
                print("  Log in first.")
                continue
            fetch_songs()

        elif choice == "4":
            if not session["logged_in"]:
                print("  Not logged in.")
                continue
            logout_user()
            print("  Logged out.")

        elif choice == "5":
            print("  Bye!")
            break


if __name__ == "__main__":
    main()
