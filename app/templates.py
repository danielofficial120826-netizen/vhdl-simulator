"""
Preset VHDL Examples and Testbenches for VHDL Web Studio.
Each template includes complete IEEE-standard synthesizable RTL code and matching testbench.
"""
from typing import Dict, List, Any, Optional

EXAMPLES: List[Dict[str, Any]] = [
    {
        "id": "counter_4bit",
        "title": "4-Bit Binary Counter",
        "category": "Sequential",
        "description": "4-bit synchronous up-counter with asynchronous active-high reset, synchronous load and enable.",
        "design": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity counter_4bit is
    Port (
        clk   : in  std_logic;
        rst   : in  std_logic;
        en    : in  std_logic;
        load  : in  std_logic;
        din   : in  std_logic_vector(3 downto 0);
        count : out std_logic_vector(3 downto 0);
        co    : out std_logic
    );
end entity counter_4bit;

architecture Behavioral of counter_4bit is
    signal count_reg : unsigned(3 downto 0) := (others => '0');
begin
    process(clk, rst)
    begin
        if rst = '1' then
            count_reg <= (others => '0');
        elsif rising_edge(clk) then
            if load = '1' then
                count_reg <= unsigned(din);
            elsif en = '1' then
                count_reg <= count_reg + 1;
            end if;
        end if;
    end process;

    count <= std_logic_vector(count_reg);
    co    <= '1' when (count_reg = "1111" and en = '1') else '0';

end architecture Behavioral;
""",
        "testbench": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tb_counter_4bit is
end entity tb_counter_4bit;

architecture Sim of tb_counter_4bit is
    signal clk   : std_logic := '0';
    signal rst   : std_logic := '1';
    signal en    : std_logic := '0';
    signal load  : std_logic := '0';
    signal din   : std_logic_vector(3 downto 0) := "0000";
    signal count : std_logic_vector(3 downto 0);
    signal co    : std_logic;

    constant CLK_PERIOD : time := 10 ns;
begin
    -- Instantiate Unit Under Test (UUT)
    uut: entity work.counter_4bit
        port map (
            clk   => clk,
            rst   => rst,
            en    => en,
            load  => load,
            din   => din,
            count => count,
            co    => co
        );

    -- Clock Generator
    clk_process: process
    begin
        while now < 250 ns loop
            clk <= '0';
            wait for CLK_PERIOD / 2;
            clk <= '1';
            wait for CLK_PERIOD / 2;
        end loop;
        wait;
    end process;

    -- Stimulus process
    stim_proc: process
    begin
        -- Initial reset
        rst <= '1';
        wait for 20 ns;
        rst <= '0';
        wait for 10 ns;

        -- Enable counting
        en <= '1';
        wait for 120 ns;

        -- Test parallel load
        load <= '1';
        din <= "1100";
        wait for 10 ns;
        load <= '0';
        wait for 60 ns;

        -- Disable counting
        en <= '0';
        wait for 30 ns;

        wait;
    end process;

end architecture Sim;
"""
    },
    {
        "id": "alu_8bit",
        "title": "8-Bit Arithmetic Logic Unit (ALU)",
        "category": "Arithmetic & Logic",
        "description": "8-bit multi-function ALU with 8 operations, Zero flag, and Carry flag.",
        "design": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity alu_8bit is
    Port (
        a      : in  std_logic_vector(7 downto 0);
        b      : in  std_logic_vector(7 downto 0);
        opcode : in  std_logic_vector(2 downto 0);
        result : out std_logic_vector(7 downto 0);
        zero   : out std_logic;
        carry  : out std_logic
    );
end entity alu_8bit;

architecture Behavioral of alu_8bit is
    signal res_ext : unsigned(8 downto 0);
begin
    process(a, b, opcode)
        variable u_a : unsigned(8 downto 0);
        variable u_b : unsigned(8 downto 0);
    begin
        u_a := unsigned('0' & a);
        u_b := unsigned('0' & b);
        
        case opcode is
            when "000" => -- ADD
                res_ext <= u_a + u_b;
            when "001" => -- SUB
                res_ext <= u_a - u_b;
            when "010" => -- AND
                res_ext <= '0' & (unsigned(a) and unsigned(b));
            when "011" => -- OR
                res_ext <= '0' & (unsigned(a) or unsigned(b));
            when "100" => -- XOR
                res_ext <= '0' & (unsigned(a) xor unsigned(b));
            when "101" => -- NOT A
                res_ext <= '0' & (not unsigned(a));
            when "110" => -- SHL A
                res_ext <= unsigned(a(7 downto 0) & '0');
            when "111" => -- SHR A
                res_ext <= '0' & '0' & unsigned(a(7 downto 1));
            when others =>
                res_ext <= (others => '0');
        end case;
    end process;

    result <= std_logic_vector(res_ext(7 downto 0));
    carry  <= res_ext(8);
    zero   <= '1' when res_ext(7 downto 0) = "00000000" else '0';

end architecture Behavioral;
""",
        "testbench": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tb_alu_8bit is
end entity tb_alu_8bit;

architecture Sim of tb_alu_8bit is
    signal a      : std_logic_vector(7 downto 0) := (others => '0');
    signal b      : std_logic_vector(7 downto 0) := (others => '0');
    signal opcode : std_logic_vector(2 downto 0) := "000";
    signal result : std_logic_vector(7 downto 0);
    signal zero   : std_logic;
    signal carry  : std_logic;
begin
    uut: entity work.alu_8bit
        port map (
            a      => a,
            b      => b,
            opcode => opcode,
            result => result,
            zero   => zero,
            carry  => carry
        );

    stim_proc: process
    begin
        wait for 10 ns;
        -- Test ADD: 15 + 25 = 40
        a <= x"0F";
        b <= x"19";
        opcode <= "000";
        wait for 20 ns;

        -- Test ADD with carry overflow: 200 + 100 = 300
        a <= x"C8";
        b <= x"64";
        opcode <= "000";
        wait for 20 ns;

        -- Test SUB: 50 - 50 = 0 (Check Zero flag)
        a <= x"32";
        b <= x"32";
        opcode <= "001";
        wait for 20 ns;

        -- Test AND: 0xAA and 0x55 = 0x00
        a <= x"AA";
        b <= x"55";
        opcode <= "010";
        wait for 20 ns;

        -- Test OR: 0xAA or 0x0F = 0xAF
        a <= x"AA";
        b <= x"0F";
        opcode <= "011";
        wait for 20 ns;

        -- Test XOR: 0xFF xor 0x0F = 0xF0
        a <= x"FF";
        b <= x"0F";
        opcode <= "100";
        wait for 20 ns;

        -- Test SHL
        a <= x"03";
        opcode <= "110";
        wait for 20 ns;

        wait;
    end process;
end architecture Sim;
"""
    },
    {
        "id": "traffic_fsm",
        "title": "Traffic Light Controller (FSM)",
        "category": "State Machines",
        "description": "Finite State Machine controlling Main Street and Side Street traffic signals with sensor detection.",
        "design": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity traffic_fsm is
    Port (
        clk         : in  std_logic;
        rst         : in  std_logic;
        car_sensor  : in  std_logic;
        main_red    : out std_logic;
        main_yellow : out std_logic;
        main_green  : out std_logic;
        side_red    : out std_logic;
        side_yellow : out std_logic;
        side_green  : out std_logic
    );
end entity traffic_fsm;

architecture Behavioral of traffic_fsm is
    type state_type is (MAIN_GRN, MAIN_YEL, SIDE_GRN, SIDE_YEL);
    signal current_state, next_state : state_type := MAIN_GRN;
    signal timer : integer range 0 to 15 := 0;
begin
    -- State transition and timer register
    process(clk, rst)
    begin
        if rst = '1' then
            current_state <= MAIN_GRN;
            timer <= 0;
        elsif rising_edge(clk) then
            if current_state /= next_state then
                current_state <= next_state;
                timer <= 0;
            else
                timer <= timer + 1;
            end if;
        end if;
    end process;

    -- Next state logic
    process(current_state, car_sensor, timer)
    begin
        next_state <= current_state;
        case current_state is
            when MAIN_GRN =>
                if car_sensor = '1' and timer >= 5 then
                    next_state <= MAIN_YEL;
                end if;
            when MAIN_YEL =>
                if timer >= 2 then
                    next_state <= SIDE_GRN;
                end if;
            when SIDE_GRN =>
                if timer >= 4 or car_sensor = '0' then
                    next_state <= SIDE_YEL;
                end if;
            when SIDE_YEL =>
                if timer >= 2 then
                    next_state <= MAIN_GRN;
                end if;
        end case;
    end process;

    -- Output logic (Moore outputs)
    main_green  <= '1' when current_state = MAIN_GRN else '0';
    main_yellow <= '1' when current_state = MAIN_YEL else '0';
    main_red    <= '1' when (current_state = SIDE_GRN or current_state = SIDE_YEL) else '0';

    side_green  <= '1' when current_state = SIDE_GRN else '0';
    side_yellow <= '1' when current_state = SIDE_YEL else '0';
    side_red    <= '1' when (current_state = MAIN_GRN or current_state = MAIN_YEL) else '0';

end architecture Behavioral;
""",
        "testbench": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity tb_traffic_fsm is
end entity tb_traffic_fsm;

architecture Sim of tb_traffic_fsm is
    signal clk         : std_logic := '0';
    signal rst         : std_logic := '1';
    signal car_sensor  : std_logic := '0';
    signal main_red    : std_logic;
    signal main_yellow : std_logic;
    signal main_green  : std_logic;
    signal side_red    : std_logic;
    signal side_yellow : std_logic;
    signal side_green  : std_logic;

    constant CLK_PERIOD : time := 10 ns;
begin
    uut: entity work.traffic_fsm
        port map (
            clk         => clk,
            rst         => rst,
            car_sensor  => car_sensor,
            main_red    => main_red,
            main_yellow => main_yellow,
            main_green  => main_green,
            side_red    => side_red,
            side_yellow => side_yellow,
            side_green  => side_green
        );

    clk_proc: process
    begin
        while now < 300 ns loop
            clk <= '0'; wait for CLK_PERIOD / 2;
            clk <= '1'; wait for CLK_PERIOD / 2;
        end loop;
        wait;
    end process;

    stim_proc: process
    begin
        rst <= '1';
        wait for 20 ns;
        rst <= '0';
        wait for 40 ns;

        -- Car arrives on side street
        car_sensor <= '1';
        wait for 150 ns;

        -- Car leaves
        car_sensor <= '0';
        wait for 80 ns;

        wait;
    end process;
end architecture Sim;
"""
    },
    {
        "id": "full_adder_4bit",
        "title": "4-Bit Full Adder (Carry Lookahead)",
        "category": "Combinational",
        "description": "4-bit fast adder with Propagate/Generate carry logic.",
        "design": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity full_adder_4bit is
    Port (
        a    : in  std_logic_vector(3 downto 0);
        b    : in  std_logic_vector(3 downto 0);
        cin  : in  std_logic;
        sum  : out std_logic_vector(3 downto 0);
        cout : out std_logic
    );
end entity full_adder_4bit;

architecture Structural of full_adder_4bit is
    signal p, g : std_logic_vector(3 downto 0);
    signal c    : std_logic_vector(4 downto 0);
begin
    -- Carry Generation & Propagation
    p <= a xor b;
    g <= a and b;

    c(0) <= cin;
    c(1) <= g(0) or (p(0) and c(0));
    c(2) <= g(1) or (p(1) and g(0)) or (p(1) and p(0) and c(0));
    c(3) <= g(2) or (p(2) and g(1)) or (p(2) and p(1) and g(0)) or (p(2) and p(1) and p(0) and c(0));
    c(4) <= g(3) or (p(3) and g(2)) or (p(3) and p(2) and g(1)) or (p(3) and p(2) and p(1) and g(0)) or (p(3) and p(2) and p(1) and p(0) and c(0));

    sum  <= p xor c(3 downto 0);
    cout <= c(4);

end architecture Structural;
""",
        "testbench": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity tb_full_adder_4bit is
end entity tb_full_adder_4bit;

architecture Sim of tb_full_adder_4bit is
    signal a    : std_logic_vector(3 downto 0) := "0000";
    signal b    : std_logic_vector(3 downto 0) := "0000";
    signal cin  : std_logic := '0';
    signal sum  : std_logic_vector(3 downto 0);
    signal cout : std_logic;
begin
    uut: entity work.full_adder_4bit
        port map (
            a    => a,
            b    => b,
            cin  => cin,
            sum  => sum,
            cout => cout
        );

    stim_proc: process
    begin
        wait for 10 ns;
        -- 3 + 5 = 8
        a <= "0011"; b <= "0101"; cin <= '0'; wait for 20 ns;

        -- 7 + 8 + 1 (cin) = 16 (sum=0, cout=1)
        a <= "0111"; b <= "1000"; cin <= '1'; wait for 20 ns;

        -- 15 + 15 = 30 (sum=14, cout=1)
        a <= "1111"; b <= "1111"; cin <= '0'; wait for 20 ns;

        -- 9 + 6 = 15
        a <= "1001"; b <= "0110"; cin <= '0'; wait for 20 ns;

        wait;
    end process;
end architecture Sim;
"""
    },
    {
        "id": "pwm_generator",
        "title": "PWM Controller",
        "category": "Control & Peripherals",
        "description": "Pulse Width Modulation generator with 8-bit resolution and configurable duty cycle.",
        "design": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity pwm_generator is
    Port (
        clk        : in  std_logic;
        rst        : in  std_logic;
        duty_cycle : in  std_logic_vector(7 downto 0);
        pwm_out    : out std_logic
    );
end entity pwm_generator;

architecture Behavioral of pwm_generator is
    signal counter_reg : unsigned(7 downto 0) := (others => '0');
begin
    process(clk, rst)
    begin
        if rst = '1' then
            counter_reg <= (others => '0');
            pwm_out <= '0';
        elsif rising_edge(clk) then
            counter_reg <= counter_reg + 1;
            if counter_reg < unsigned(duty_cycle) then
                pwm_out <= '1';
            else
                pwm_out <= '0';
            end if;
        end if;
    end process;
end architecture Behavioral;
""",
        "testbench": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity tb_pwm_generator is
end entity tb_pwm_generator;

architecture Sim of tb_pwm_generator is
    signal clk        : std_logic := '0';
    signal rst        : std_logic := '1';
    signal duty_cycle : std_logic_vector(7 downto 0) := x"40"; -- 25% duty
    signal pwm_out    : std_logic;

    constant CLK_PERIOD : time := 10 ns;
begin
    uut: entity work.pwm_generator
        port map (
            clk        => clk,
            rst        => rst,
            duty_cycle => duty_cycle,
            pwm_out    => pwm_out
        );

    clk_process: process
    begin
        while now < 6000 ns loop
            clk <= '0'; wait for CLK_PERIOD / 2;
            clk <= '1'; wait for CLK_PERIOD / 2;
        end loop;
        wait;
    end process;

    stim_proc: process
    begin
        rst <= '1';
        wait for 20 ns;
        rst <= '0';
        
        -- 25% duty cycle
        duty_cycle <= x"40";
        wait for 2600 ns;

        -- 75% duty cycle
        duty_cycle <= x"C0";
        wait for 2600 ns;

        wait;
    end process;
end architecture Sim;
"""
    },
    {
        "id": "seven_seg_decoder",
        "title": "7-Segment Display Decoder",
        "category": "Display & IO",
        "description": "BCD (Binary Coded Decimal) to 7-segment display cathode decoder with blanking control.",
        "design": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity seven_seg_decoder is
    Port (
        bcd     : in  std_logic_vector(3 downto 0);
        blank   : in  std_logic;
        seg_out : out std_logic_vector(6 downto 0) -- a, b, c, d, e, f, g (active low)
    );
end entity seven_seg_decoder;

architecture Behavioral of seven_seg_decoder is
begin
    process(bcd, blank)
    begin
        if blank = '1' then
            seg_out <= "1111111"; -- all segments off
        else
            case bcd is
                when "0000" => seg_out <= "0000001"; -- 0
                when "0001" => seg_out <= "1001111"; -- 1
                when "0010" => seg_out <= "0010010"; -- 2
                when "0011" => seg_out <= "0000110"; -- 3
                when "0100" => seg_out <= "1001100"; -- 4
                when "0101" => seg_out <= "0100100"; -- 5
                when "0110" => seg_out <= "0100000"; -- 6
                when "0111" => seg_out <= "0001111"; -- 7
                when "1000" => seg_out <= "0000000"; -- 8
                when "1001" => seg_out <= "0000100"; -- 9
                when "1010" => seg_out <= "0001000"; -- A
                when "1011" => seg_out <= "1100000"; -- b
                when "1100" => seg_out <= "0110001"; -- C
                when "1101" => seg_out <= "1000010"; -- d
                when "1110" => seg_out <= "0110000"; -- E
                when "1111" => seg_out <= "0111000"; -- F
                when others => seg_out <= "1111111";
            end case;
        end if;
    end process;
end architecture Behavioral;
""",
        "testbench": """library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tb_seven_seg_decoder is
end entity tb_seven_seg_decoder;

architecture Sim of tb_seven_seg_decoder is
    signal bcd     : std_logic_vector(3 downto 0) := "0000";
    signal blank   : std_logic := '0';
    signal seg_out : std_logic_vector(6 downto 0);
begin
    uut: entity work.seven_seg_decoder
        port map (
            bcd     => bcd,
            blank   => blank,
            seg_out => seg_out
        );

    stim_proc: process
    begin
        for i in 0 to 15 loop
            bcd <= std_logic_vector(to_unsigned(i, 4));
            wait for 15 ns;
        end loop;

        -- Test blanking
        blank <= '1';
        wait for 30 ns;
        blank <= '0';
        wait;
    end process;
end architecture Sim;
"""
    }
]


def get_all_examples() -> List[Dict[str, Any]]:
    return [
        {
            "id": ex["id"],
            "title": ex["title"],
            "category": ex["category"],
            "description": ex["description"]
        } for ex in EXAMPLES
    ]


def get_example_by_id(example_id: str) -> Optional[Dict[str, Any]]:
    for ex in EXAMPLES:
        if ex["id"] == example_id:
            return ex
    return None
