"""卡牌游戏主入口"""

from card_game.core.game import CardGame, GamePhase
from card_game.core.characters import get_all_characters


def print_characters():
    """打印可选角色"""
    chars = get_all_characters()
    print("\n可选角色:")
    for i, char in enumerate(chars):
        print(f"  {i+1}. {char.name} - HP:{char.hp}")


def choose_character(is_ai: bool = False) -> str:
    """选择角色"""
    chars = get_all_characters()
    while True:
        print_characters()
        if is_ai:
            import random
            choice = random.choice(chars)
            print(f"AI 选择: {choice.name}")
            return choice.card_id
        else:
            try:
                choice = input("\n选择角色编号: ").strip()
                idx = int(choice) - 1
                if 0 <= idx < len(chars):
                    return chars[idx].card_id
                print("无效选择")
            except ValueError:
                print("请输入有效编号")


def run_game():
    """运行游戏"""
    print("="*50)
    print("       卡牌游戏 (Card Game)")
    print("="*50)

    # 选择角色
    player_char = choose_character(is_ai=False)
    ai_char = choose_character(is_ai=True)

    # 创建游戏
    game = CardGame()
    game.start_game(player_char, ai_char)

    # 游戏主循环
    while not game.is_game_over():
        game.print_status()

        if game.phase == GamePhase.PHASE1:
            game.phase1_energy_placement()
        elif game.phase == GamePhase.PHASE2:
            game.phase2_action()
        elif game.phase == GamePhase.PHASE3:
            game.phase3_mark_resolution()

    # 游戏结束
    print("\n" + "="*50)
    if game.winner:
        print(f"游戏结束！{game.winner.name} 获胜！")
    else:
        print("游戏结束！平局！")
    print("="*50)


if __name__ == "__main__":
    run_game()